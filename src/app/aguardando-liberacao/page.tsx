import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock, ExternalLink, MessageCircle, ShieldAlert } from 'lucide-react'
import { EstokeiMark } from '@/components/estokei-mark'
import { loadMemberships } from '@/lib/auth'
import { isPlatformAdmin } from '@/lib/platform'
import { whatsappLink } from '@/lib/sales'
import { canManageTeam } from '@/lib/team'
import { loadBilling } from '@/lib/billing-data'
import { asaasConfigured } from '@/lib/asaas'
import { BILLING_SUSPENSION_REASON } from '@/lib/billing'
import { getPlan, preselectedPlan, type BillingCycle } from '@/lib/plans'
import { formatDateBR } from '@/lib/utils'
import { SignOutButton } from '../(app)/sign-out-button'
import { PlanCheckoutForm } from '../(app)/configuracoes/plano/plan-checkout-form'
import { UseOrganizationButton } from './use-organization-button'

export const metadata = { title: 'Aguardando liberação' }

/**
 * Empresa nova (aguardando liberação) ou suspensa cai aqui em vez do painel.
 * Empresa nova: dono/admin escolhe o plano e paga; depois do pagamento o dono
 * da plataforma confere e libera. Suspensa por falta de pagamento: pagar a
 * cobrança em aberto reativa sozinho.
 */
export default async function AguardandoLiberacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string; ciclo?: string }>
}) {
  const { user, memberships, current } = await loadMemberships()
  const preselected = preselectedPlan(await searchParams, user.user_metadata)
  if (!current) redirect('/onboard')
  const org = current.organizations!
  if (org.status === 'active') redirect('/painel')

  const suspended = org.status === 'suspended'
  const isAdmin = canManageTeam(current.role)
  const { subscription, state } = isAdmin
    ? await loadBilling(current.organization_id)
    : { subscription: null, state: { kind: 'none' as const } }
  const others = memberships.filter(
    (m) => m.organization_id !== current.organization_id && m.organizations!.status === 'active'
  )
  const message = suspended
    ? `Olá! O acesso da empresa ${org.name} ao Estokei está suspenso e quero regularizar.`
    : `Olá! Criei a empresa ${org.name} no Estokei e tenho uma dúvida sobre os planos.`

  const paid = state.kind === 'active'
  const openInvoice =
    state.kind === 'overdue'
      ? state.payment
      : state.kind === 'awaiting_payment'
        ? state.payment
        : null
  const choosePlan = !suspended && isAdmin && (state.kind === 'none' || state.kind === 'canceled')
  const billingSuspension = suspended && org.status_reason === BILLING_SUSPENSION_REASON

  let title = 'Cadastro recebido!'
  if (suspended) title = 'Acesso suspenso'
  else if (paid) title = 'Pagamento confirmado!'
  else if (choosePlan) title = 'Escolha seu plano'

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className={`w-full space-y-6 ${choosePlan ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex justify-center">
          <EstokeiMark />
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="space-y-4 text-center">
            <div
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
                suspended
                  ? 'bg-rose-100 text-rose-700'
                  : paid
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {suspended ? (
                <ShieldAlert className="h-6 w-6" />
              ) : paid ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : (
                <Clock className="h-6 w-6" />
              )}
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">
                {suspended ? (
                  <>
                    O acesso da <strong className="text-foreground">{org.name}</strong> ao
                    Estokei está suspenso. Os dados continuam guardados.
                    {billingSuspension && openInvoice
                      ? ' Assim que o pagamento for confirmado, o acesso volta sozinho.'
                      : ' Fale com a gente para regularizar.'}
                  </>
                ) : paid ? (
                  <>
                    Recebemos o pagamento da <strong className="text-foreground">{org.name}</strong>.
                    Estamos conferindo o cadastro e liberamos o acesso em até 1 dia útil — você
                    recebe um e-mail quando estiver liberado.
                  </>
                ) : choosePlan ? (
                  <>
                    A empresa <strong className="text-foreground">{org.name}</strong> foi criada.
                    Escolha o plano e faça o pagamento; depois da confirmação, liberamos o acesso da
                    sua equipe.
                  </>
                ) : isAdmin ? (
                  <>
                    A empresa <strong className="text-foreground">{org.name}</strong> está aguardando
                    o pagamento
                    {subscription ? ` do plano ${getPlan(subscription.plan)?.name ?? ''}` : ''}.
                    Depois da confirmação, liberamos o acesso da sua equipe.
                  </>
                ) : (
                  <>
                    A empresa <strong className="text-foreground">{org.name}</strong> está aguardando
                    liberação. Peça ao responsável pela empresa para escolher o plano e fazer o
                    pagamento.
                  </>
                )}
              </p>
              {suspended && org.status_reason ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  Motivo: {org.status_reason}
                </p>
              ) : null}
            </div>
          </div>

          {openInvoice?.invoice_url && isAdmin && (suspended ? billingSuspension : true) ? (
            <div className="space-y-2 text-center">
              <a
                href={openInvoice.invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Pagar agora
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
              <p className="text-xs text-muted-foreground">
                Vencimento em {formatDateBR(openInvoice.due_date)}. Pix e cartão são confirmados na
                hora; boleto, em até 3 dias úteis.
              </p>
            </div>
          ) : null}

          {choosePlan ? (
            asaasConfigured() ? (
              <PlanCheckoutForm
                defaultName={org.name}
                defaultEmail={user.email ?? ''}
                defaultPlan={preselected.plan}
                defaultCycle={preselected.cycle}
              />
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Fale com a gente no WhatsApp para escolher o plano e liberar o acesso.
              </p>
            )
          ) : null}

          {!suspended && isAdmin && state.kind === 'awaiting_payment' && asaasConfigured() ? (
            <details className="rounded-md border p-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Trocar de plano</summary>
              <div className="mt-4">
                <PlanCheckoutForm
                  defaultName={subscription?.billing_name ?? org.name}
                  defaultEmail={subscription?.billing_email ?? user.email ?? ''}
                  defaultPlan={getPlan(subscription?.plan)?.slug}
                  defaultCycle={subscription?.cycle as BillingCycle | undefined}
                  submitLabel="Trocar e ir para o pagamento"
                />
              </div>
            </details>
          ) : null}

          <a
            href={whatsappLink(message)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted/50"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            {suspended ? 'Falar no WhatsApp' : 'Dúvidas? Fale no WhatsApp'}
          </a>
          <p className="text-center text-xs text-muted-foreground">
            Já foi liberado? É só{' '}
            <Link href="/painel" className="underline">
              recarregar esta página
            </Link>
            .
          </p>
        </div>

        {others.length > 0 ? (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium">Você também participa de:</p>
            {others.map((m) => (
              <UseOrganizationButton
                key={m.organization_id}
                id={m.organization_id}
                name={m.organizations!.name}
              />
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate text-muted-foreground">{user.email}</span>
          {isPlatformAdmin(user.email) ? (
            <Link href="/plataforma" className="font-medium underline">
              Plataforma
            </Link>
          ) : null}
        </div>
        <SignOutButton />
      </div>
    </main>
  )
}
