import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EstokeiMark } from '@/components/estokei-mark'
import { requireUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { ORG_STATUS_LABEL, isPlatformAdmin, type OrgStatus } from '@/lib/platform'
import { formatDateBR, todayISO } from '@/lib/utils'

import { billingState, type BillingState } from '@/lib/billing'
import { CYCLE_LABEL, getPlan, type BillingCycle } from '@/lib/plans'
import { WEBHOOK_NAME, asaasEnvironment, listWebhooks } from '@/lib/asaas'
import { OrgStatusActions } from './org-status-actions'
import { PlatformActionButton } from './platform-action-button'
import { configureAsaasWebhookAction, enableInvoicesForAllAction } from './actions'
import { nfseSettings } from '@/lib/nfse'

export const metadata = { title: 'Plataforma' }

const PAGE = 1000

const STATUS_CHIP: Record<OrgStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  suspended: 'bg-rose-100 text-rose-800 border-rose-200',
}

const STATUS_ORDER: Record<OrgStatus, number> = { pending: 0, active: 1, suspended: 2 }

const BILLING_TEXT: Record<BillingState['kind'], { cls: string }> = {
  none: { cls: 'text-muted-foreground' },
  canceled: { cls: 'text-muted-foreground' },
  awaiting_payment: { cls: 'text-amber-700' },
  overdue: { cls: 'text-rose-700' },
  active: { cls: 'text-emerald-700' },
}

function billingText(state: BillingState): string {
  switch (state.kind) {
    case 'none':
      return 'Sem assinatura no sistema'
    case 'canceled':
      return 'Assinatura cancelada'
    case 'awaiting_payment':
      return 'Aguardando 1º pagamento'
    case 'overdue':
      return `Atrasado ${state.daysOverdue} dia${state.daysOverdue === 1 ? '' : 's'} (suspende em ${formatDateBR(state.suspendOn)})`
    case 'active':
      return state.nextPayment ? `Em dia · próxima ${formatDateBR(state.nextPayment.due_date)}` : 'Em dia'
  }
}

/** Ambiente da chave do Asaas e situação do webhook (só para o painel). */
async function loadAsaasStatus(): Promise<{
  environment: 'sandbox' | 'production' | null
  webhookOk: boolean
  message: string
}> {
  const environment = asaasEnvironment()
  if (!environment) {
    return { environment, webhookOk: false, message: 'Chave do Asaas não configurada neste ambiente.' }
  }
  try {
    const hook = (await listWebhooks()).find((w) => w.name === WEBHOOK_NAME)
    if (!hook) return { environment, webhookOk: false, message: 'Webhook ainda não cadastrado — os pagamentos não chegam ao sistema.' }
    if (hook.interrupted) return { environment, webhookOk: false, message: 'Webhook pausado pelo Asaas depois de falhas seguidas. Reconfigure.' }
    if (!hook.enabled) return { environment, webhookOk: false, message: 'Webhook desligado no Asaas.' }
    return { environment, webhookOk: true, message: 'Conectado: os pagamentos chegam ao sistema automaticamente.' }
  } catch (err) {
    return {
      environment,
      webhookOk: false,
      message: `Não foi possível falar com o Asaas: ${err instanceof Error ? err.message : 'erro desconhecido'}`,
    }
  }
}

/**
 * Tela do dono da plataforma: todas as empresas clientes, com situação, dono,
 * tamanho e última atividade. Usa o service role (vê todas as empresas) — por
 * isso só abre para PLATFORM_ADMIN_EMAILS; para os demais, a página não existe.
 */
export default async function PlataformaPage() {
  const user = await requireUser()
  if (!isPlatformAdmin(user.email)) notFound()

  const admin = createServiceClient()
  const [{ data: orgs }, { data: members }, { data: profiles }, { data: subs }, { data: payments }, asaas] =
    await Promise.all([
      admin.from('organizations').select('id, name, status, status_reason, created_at, status_changed_at, is_demo').order('created_at'),
      admin.from('organization_members').select('organization_id, user_id, role').range(0, PAGE - 1),
      admin.from('profiles').select('user_id, full_name, email').range(0, PAGE - 1),
      admin
        .from('subscriptions')
        .select('organization_id, plan, cycle, canceled_at, nfse_configured_at')
        .range(0, PAGE - 1),
      // Só cobranças dos últimos 13 meses importam para a situação atual.
      admin
        .from('subscription_payments')
        .select('id, organization_id, status, value, due_date, paid_at, invoice_url, deleted, invoice_status')
        .gte('due_date', todayISO(-400))
        .range(0, PAGE * 5 - 1),
      loadAsaasStatus(),
    ])

  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]))
  const rows = (orgs ?? [])
    .map((o) => {
      const orgMembers = (members ?? []).filter((m) => m.organization_id === o.id)
      const owner = orgMembers.find((m) => m.role === 'owner')
      const ownerProfile = owner ? profileById.get(owner.user_id) : undefined
      const sub = (subs ?? []).find((s) => s.organization_id === o.id) ?? null
      const billing = billingState(
        sub,
        (payments ?? []).filter((p) => p.organization_id === o.id),
        todayISO()
      )
      return {
        ...o,
        sub,
        billing,
        invoiceErrors: (payments ?? []).filter(
          (p) => p.organization_id === o.id && !p.deleted && p.invoice_status === 'ERROR'
        ).length,
        status: o.status as OrgStatus,
        ownerName: ownerProfile?.full_name || ownerProfile?.email || '—',
        ownerEmail: ownerProfile?.email ?? null,
        memberCount: orgMembers.length,
      }
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.created_at.localeCompare(a.created_at))

  const count = (s: OrgStatus) => rows.filter((r) => r.status === s).length
  const nfseOn = !!nfseSettings()
  const withoutInvoices = (subs ?? []).filter((s) => !s.canceled_at && !s.nfse_configured_at).length

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <EstokeiMark />
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              Plataforma
            </span>
          </div>
          <Link href="/painel" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Voltar ao sistema
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empresas clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} empresa{rows.length === 1 ? '' : 's'} · {count('active')} liberada
            {count('active') === 1 ? '' : 's'} · {count('pending')} aguardando · {count('suspended')}{' '}
            suspensa{count('suspended') === 1 ? '' : 's'}
          </p>
        </div>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm">
          <div>
            <div className="font-medium">
              Cobrança (Asaas){' '}
              {asaas.environment ? (
                <span className="rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  {asaas.environment === 'production' ? 'produção' : 'sandbox (testes)'}
                </span>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">{asaas.message}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {nfseOn
                ? withoutInvoices > 0
                  ? `Nota fiscal automática ligada — ${withoutInvoices} assinatura(s) ativa(s) ainda sem nota automática.`
                  : 'Nota fiscal automática ligada em todas as assinaturas ativas.'
                : 'Nota fiscal automática desligada (aguardando os dados do contador): emita a nota de cada pagamento no site da prefeitura.'}
            </div>
          </div>
          {asaas.environment ? (
            <div className="flex flex-wrap gap-2">
              {nfseOn && withoutInvoices > 0 ? (
                <PlatformActionButton label="Ligar nota nessas assinaturas" action={enableInvoicesForAllAction} />
              ) : null}
              <PlatformActionButton
                label={asaas.webhookOk ? 'Reconfigurar webhook' : 'Configurar webhook'}
                action={configureAsaasWebhookAction}
              />
            </div>
          ) : null}
        </section>

        {count('pending') > 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {count('pending')} empresa{count('pending') === 1 ? '' : 's'} aguardando liberação. Depois
            de combinar o plano com o cliente, clique em <strong>Liberar</strong> — o responsável
            recebe um e-mail avisando.
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Empresa</th>
                <th className="px-4 py-2 font-medium">Situação</th>
                <th className="px-4 py-2 font-medium">Responsável</th>
                <th className="px-4 py-2 font-medium">Plano e pagamento</th>
                <th className="px-4 py-2 font-medium text-right">Pessoas</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {r.name}
                      {r.is_demo ? (
                        <span className="ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                          demonstração
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">Criada em {formatDateBR(r.created_at)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${STATUS_CHIP[r.status]}`}>
                      {ORG_STATUS_LABEL[r.status]}
                    </span>
                    {r.status_changed_at ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        desde {formatDateBR(r.status_changed_at)}
                      </div>
                    ) : null}
                    {r.status === 'suspended' && r.status_reason ? (
                      <div className="mt-1 max-w-[14rem] text-xs text-rose-700">
                        Motivo: {r.status_reason}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div>{r.ownerName}</div>
                    {r.ownerEmail && r.ownerEmail !== r.ownerName ? (
                      <div className="text-xs text-muted-foreground">{r.ownerEmail}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {r.sub ? (
                      <div>
                        {getPlan(r.sub.plan)?.name ?? r.sub.plan} ·{' '}
                        {CYCLE_LABEL[r.sub.cycle as BillingCycle] ?? r.sub.cycle}
                      </div>
                    ) : null}
                    <div className={`text-xs ${BILLING_TEXT[r.billing.kind].cls}`}>
                      {billingText(r.billing)}
                    </div>
                    {r.invoiceErrors > 0 ? (
                      <div className="text-xs text-rose-700">
                        {r.invoiceErrors} nota{r.invoiceErrors === 1 ? '' : 's'} fiscal com erro (veja no Asaas)
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.memberCount}</td>
                  <td className="px-4 py-3">
                    <OrgStatusActions id={r.id} name={r.name} status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
