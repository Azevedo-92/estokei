import { ExternalLink } from 'lucide-react'
import { requireOrganization } from '@/lib/auth'
import { canManageTeam } from '@/lib/team'
import { loadBilling } from '@/lib/billing-data'
import { asaasConfigured } from '@/lib/asaas'
import { formatDocument, paymentStatusLabel, type BillingState } from '@/lib/billing'
import { CYCLE_LABEL, getPlan, preselectedPlan, type BillingCycle } from '@/lib/plans'
import { cn, formatCurrencyBRL, formatDateBR } from '@/lib/utils'
import { whatsappLink } from '@/lib/sales'
import { invoiceStatusLabel } from '@/lib/nfse'
import { PlanCheckoutForm } from './plan-checkout-form'

export const metadata = { title: 'Plano e pagamento' }

const STATE_CHIP: Record<BillingState['kind'], { label: string; cls: string }> = {
  none: { label: 'Sem assinatura', cls: 'bg-muted text-muted-foreground border-border' },
  canceled: { label: 'Cancelada', cls: 'bg-muted text-muted-foreground border-border' },
  awaiting_payment: { label: 'Aguardando pagamento', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  overdue: { label: 'Pagamento atrasado', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  active: { label: 'Em dia', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
}

export default async function PlanoPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string; ciclo?: string }>
}) {
  const { organization, role, user } = await requireOrganization()
  const preselected = preselectedPlan(await searchParams, user.user_metadata)

  if (!canManageTeam(role)) {
    return (
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Plano e pagamento</h1>
        <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
          Só o dono e os administradores da empresa veem o plano e os pagamentos.
        </p>
      </div>
    )
  }

  const { subscription, payments, state } = await loadBilling(organization.id)
  const plan = getPlan(subscription?.plan)
  const visiblePayments = payments.filter((p) => !p.deleted)
  const hasPlan = state.kind !== 'none' && state.kind !== 'canceled'

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Plano e pagamento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assinatura da {organization.name} no Estokei. Os pagamentos são processados pelo Asaas
          (Pix, boleto ou cartão).
        </p>
      </header>

      {hasPlan && subscription ? (
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">
                Plano {plan?.name ?? subscription.plan}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  · {CYCLE_LABEL[subscription.cycle as BillingCycle] ?? subscription.cycle} ·{' '}
                  {formatCurrencyBRL(subscription.value)}
                  {subscription.cycle === 'yearly' ? '/ano' : '/mês'}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Até {plan?.users ?? '—'} pessoas · cobrança em nome de {subscription.billing_name} (
                {formatDocument(subscription.billing_document)}) · {subscription.billing_email}
              </div>
            </div>
            <span className={cn('rounded-full border px-2.5 py-0.5 text-xs', STATE_CHIP[state.kind].cls)}>
              {STATE_CHIP[state.kind].label}
            </span>
          </div>

          {state.kind === 'overdue' ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 space-y-2">
              <p>
                A cobrança de {formatDateBR(state.payment.due_date)} está em aberto. Pague até{' '}
                <strong>{formatDateBR(state.suspendOn)}</strong> para o acesso da equipe não ser
                suspenso.
              </p>
              {state.payment.invoice_url ? <PayLink href={state.payment.invoice_url} /> : null}
            </div>
          ) : null}

          {state.kind === 'awaiting_payment' && state.payment?.invoice_url ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
              <p>A primeira cobrança está aguardando pagamento.</p>
              <PayLink href={state.payment.invoice_url} />
            </div>
          ) : null}

          {state.kind === 'active' && state.nextPayment ? (
            <p className="text-sm text-muted-foreground">
              Próxima cobrança: {formatCurrencyBRL(state.nextPayment.value)} em{' '}
              {formatDateBR(state.nextPayment.due_date)}. O Asaas envia a fatura por e-mail antes do
              vencimento.
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Para trocar de plano, mudar os dados da nota fiscal ou cancelar,{' '}
            <a
              href={whatsappLink(`Olá! Quero mudar a assinatura da ${organization.name} no Estokei.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              fale com a gente no WhatsApp
            </a>{' '}
            ou pela página Suporte.
          </p>
        </section>
      ) : null}

      {visiblePayments.length > 0 ? (
        <section className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Vencimento</th>
                <th className="px-4 py-2 font-medium text-right">Valor</th>
                <th className="px-4 py-2 font-medium">Situação</th>
                <th className="px-4 py-2 font-medium">Nota fiscal</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {visiblePayments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5">{formatDateBR(p.due_date)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrencyBRL(p.value)}</td>
                  <td className="px-4 py-2.5">
                    {paymentStatusLabel(p.status)}
                    {p.paid_at ? (
                      <span className="text-xs text-muted-foreground"> em {formatDateBR(p.paid_at)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.invoice_status === 'AUTHORIZED' && p.invoice_pdf_url ? (
                      <a
                        href={p.invoice_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs underline"
                      >
                        {p.invoice_number ? `Nº ${p.invoice_number}` : 'Ver nota'}
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {invoiceStatusLabel(p.invoice_status) ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.invoice_url ? (
                      <a
                        href={p.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs underline"
                      >
                        {p.status === 'PENDING' || p.status === 'OVERDUE' ? 'Pagar' : 'Ver fatura'}
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {!hasPlan || state.kind === 'awaiting_payment' ? (
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <div>
            <h2 className="font-semibold">
              {state.kind === 'awaiting_payment' ? 'Quer outro plano?' : 'Escolha seu plano'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {state.kind === 'awaiting_payment'
                ? 'Escolha abaixo: a cobrança em aberto é cancelada e uma nova é gerada.'
                : 'Todos os planos têm todos os recursos; muda só o tamanho da equipe.'}
            </p>
          </div>
          {asaasConfigured() ? (
            <PlanCheckoutForm
              defaultName={subscription?.billing_name ?? organization.name}
              defaultEmail={subscription?.billing_email ?? user.email ?? ''}
              defaultPlan={plan?.slug ?? preselected.plan}
              defaultCycle={(subscription?.cycle as BillingCycle | undefined) ?? preselected.cycle}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              O pagamento pelo sistema ainda não está disponível. Fale com a gente pelo WhatsApp.
            </p>
          )}
        </section>
      ) : null}
    </div>
  )
}

function PayLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    >
      Pagar agora
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </a>
  )
}
