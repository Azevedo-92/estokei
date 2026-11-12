import * as Sentry from '@sentry/nextjs'
import type { createServiceClient } from '@/lib/supabase/server'
import {
  createInvoiceSettings,
  hasInvoiceSettings,
  type AsaasInvoice,
  type AsaasPayment,
  type AsaasSubscription,
} from '@/lib/asaas'
import { invoiceSettingsBody, nfseSettings } from '@/lib/nfse'
import {
  BILLING_SUSPENSION_REASON,
  addDaysISO,
  billingState,
  isPaidStatus,
  shouldSuspendForNonPayment,
  SUSPEND_AFTER_DAYS,
  type BillingState,
} from '@/lib/billing'
import { CYCLE_LABEL, getPlan, type BillingCycle } from '@/lib/plans'
import {
  billingReactivatedEmail,
  billingSuspendedEmail,
  invoiceErrorPlatformEmail,
  paymentReceivedPlatformEmail,
  sendEmail,
} from '@/lib/email'
import { todayISO } from '@/lib/utils'

// Efeitos da cobrança no banco, com o service role: chamado pelo webhook do
// Asaas, pela action de contratar e pelo cron. Quem chama já conferiu a origem.

type Admin = ReturnType<typeof createServiceClient>

/** Grava (ou atualiza) uma cobrança do Asaas em subscription_payments. */
export async function savePayment(
  admin: Admin,
  organizationId: string,
  asaasSubscriptionId: string,
  p: AsaasPayment
): Promise<void> {
  const { error } = await admin.from('subscription_payments').upsert({
    id: p.id,
    organization_id: organizationId,
    asaas_subscription_id: asaasSubscriptionId,
    value: p.value,
    status: p.status,
    billing_type: p.billingType ?? null,
    due_date: p.dueDate,
    paid_at: p.paymentDate ?? p.clientPaymentDate ?? p.confirmedDate ?? null,
    invoice_url: p.invoiceUrl ?? null,
    deleted: !!p.deleted,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function loadBillingState(admin: Admin, organizationId: string): Promise<BillingState> {
  const [{ data: sub }, { data: payments }] = await Promise.all([
    admin.from('subscriptions').select('canceled_at').eq('organization_id', organizationId).maybeSingle(),
    admin
      .from('subscription_payments')
      .select('id, status, value, due_date, paid_at, invoice_url, deleted')
      .eq('organization_id', organizationId),
  ])
  return billingState(sub ?? null, payments ?? [], todayISO())
}

/** E-mails dos donos da empresa (para avisos de liberação e cobrança). */
export async function ownerEmails(admin: Admin, organizationId: string): Promise<string[]> {
  const { data } = await admin
    .from('organization_members')
    .select('profiles(email)')
    .eq('organization_id', organizationId)
    .eq('role', 'owner')
  return (data ?? [])
    .map((o) => (Array.isArray(o.profiles) ? o.profiles[0] : o.profiles)?.email)
    .filter((e): e is string => !!e)
}

async function sendToAll(emails: string[], tpl: { subject: string; html: string }, what: string, orgId: string) {
  if (emails.length === 0) return
  const res = await sendEmail({ to: emails[0], cc: emails.slice(1), ...tpl })
  if (!res.ok && !res.skipped) {
    Sentry.captureMessage(`${what} não foi enviado`, { level: 'warning', extra: { organizacao: orgId } })
  }
}

function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
}

/**
 * Evento de cobrança vindo do webhook. Cobrança de assinatura que não é nossa
 * (ex.: criada à mão no painel do Asaas) é ignorada. Quando uma cobrança passa
 * a paga: empresa aguardando liberação → avisa o dono da plataforma; empresa
 * suspensa por falta de pagamento e sem outra cobrança atrasada → reativa.
 */
export async function handlePaymentEvent(admin: Admin, payment: AsaasPayment): Promise<'ignored' | 'saved'> {
  if (!payment.subscription) return 'ignored'
  const { data: sub } = await admin
    .from('subscriptions')
    .select('organization_id, plan, cycle, value')
    .eq('asaas_subscription_id', payment.subscription)
    .maybeSingle()
  if (!sub) return 'ignored'

  const { data: before } = await admin
    .from('subscription_payments')
    .select('status, deleted')
    .eq('id', payment.id)
    .maybeSingle()
  await savePayment(admin, sub.organization_id, payment.subscription, payment)

  const wasPaid = !!before && !before.deleted && isPaidStatus(before.status)
  if (payment.deleted || !isPaidStatus(payment.status) || wasPaid) return 'saved'

  const orgId = sub.organization_id
  const { data: org } = await admin
    .from('organizations')
    .select('name, status, status_reason')
    .eq('id', orgId)
    .maybeSingle()
  if (!org) return 'saved'

  if (org.status === 'pending') {
    const plan = getPlan(sub.plan)
    await sendToAll(
      platformAdminEmails(),
      paymentReceivedPlatformEmail({
        orgName: org.name,
        planLabel: `${plan?.name ?? sub.plan} (${CYCLE_LABEL[sub.cycle as BillingCycle] ?? sub.cycle})`,
        value: payment.value,
      }),
      'Aviso de pagamento recebido',
      orgId
    )
  } else if (org.status === 'suspended' && org.status_reason === BILLING_SUSPENSION_REASON) {
    const state = await loadBillingState(admin, orgId)
    if (state.kind !== 'overdue') {
      const { error } = await admin
        .from('organizations')
        .update({ status: 'active', status_reason: null, status_changed_at: new Date().toISOString() })
        .eq('id', orgId)
        .eq('status', 'suspended')
      if (error) throw error
      await sendToAll(
        await ownerEmails(admin, orgId),
        billingReactivatedEmail({ orgName: org.name }),
        'Aviso de acesso reativado',
        orgId
      )
    }
  }
  return 'saved'
}

/** Assinatura removida, pausada ou reativada no Asaas. */
export async function handleSubscriptionEvent(admin: Admin, subscription: AsaasSubscription): Promise<void> {
  const canceled = !!subscription.deleted || subscription.status !== 'ACTIVE'
  const { error } = await admin
    .from('subscriptions')
    .update({ canceled_at: canceled ? new Date().toISOString() : null })
    .eq('asaas_subscription_id', subscription.id)
  if (error) throw error
}

/**
 * Cron diário: suspende empresas liberadas com cobrança vencida há
 * SUSPEND_AFTER_DAYS dias ou mais, com o motivo de falta de pagamento (pagar
 * reativa sozinho). Devolve os ids suspensos.
 */
export async function suspendOverdueOrganizations(admin: Admin): Promise<string[]> {
  const limit = addDaysISO(todayISO(), -SUSPEND_AFTER_DAYS)
  const { data, error } = await admin
    .from('subscription_payments')
    .select('organization_id')
    .eq('status', 'OVERDUE')
    .eq('deleted', false)
    .lte('due_date', limit)
  if (error) throw error

  const suspended: string[] = []
  for (const orgId of new Set((data ?? []).map((r) => r.organization_id))) {
    const { data: org } = await admin.from('organizations').select('name, status').eq('id', orgId).maybeSingle()
    if (!org || org.status !== 'active') continue
    const state = await loadBillingState(admin, orgId)
    if (!shouldSuspendForNonPayment(state) || state.kind !== 'overdue') continue

    const { error: upd } = await admin
      .from('organizations')
      .update({
        status: 'suspended',
        status_reason: BILLING_SUSPENSION_REASON,
        status_changed_at: new Date().toISOString(),
      })
      .eq('id', orgId)
      .eq('status', 'active')
    if (upd) throw upd
    suspended.push(orgId)

    await sendToAll(
      await ownerEmails(admin, orgId),
      billingSuspendedEmail({ orgName: org.name, invoiceUrl: state.payment.invoice_url }),
      'Aviso de suspensão por falta de pagamento',
      orgId
    )
  }
  return suspended
}

// ---- Nota fiscal automática --------------------------------------------------

/**
 * Liga a nota automática numa assinatura do Asaas (se ASAAS_NFSE_SETTINGS
 * estiver configurada) e marca subscriptions.nfse_configured_at. Devolve false
 * quando a nota automática está desligada neste ambiente. Erros do Asaas sobem.
 */
export async function enableSubscriptionInvoices(
  admin: Admin,
  asaasSubscriptionId: string,
  description: string
): Promise<boolean> {
  const settings = nfseSettings()
  if (!settings) return false
  if (!(await hasInvoiceSettings(asaasSubscriptionId))) {
    await createInvoiceSettings(asaasSubscriptionId, invoiceSettingsBody(settings, description))
  }
  const { error } = await admin
    .from('subscriptions')
    .update({ nfse_configured_at: new Date().toISOString() })
    .eq('asaas_subscription_id', asaasSubscriptionId)
  if (error) throw error
  return true
}

export { invoiceDescription } from '@/lib/nfse'

/**
 * Evento de nota fiscal vindo do webhook: guarda a situação, o número e o PDF
 * na cobrança que gerou a nota. Nota que passa a "com erro" avisa o dono da
 * plataforma (a nota daquele pagamento precisa ser resolvida no Asaas).
 */
export async function handleInvoiceEvent(admin: Admin, invoice: AsaasInvoice): Promise<'ignored' | 'saved'> {
  if (!invoice.payment) return 'ignored'
  const { data: row } = await admin
    .from('subscription_payments')
    .select('organization_id, invoice_status, value')
    .eq('id', invoice.payment)
    .maybeSingle()
  if (!row) return 'ignored'

  const isError = invoice.status === 'ERROR'
  const { error } = await admin
    .from('subscription_payments')
    .update({
      invoice_id: invoice.id,
      invoice_status: invoice.status,
      invoice_number: invoice.number ?? null,
      invoice_pdf_url: invoice.pdfUrl ?? null,
      invoice_error: isError ? (invoice.statusDescription ?? 'Erro sem descrição').slice(0, 1000) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoice.payment)
  if (error) throw error

  if (isError && row.invoice_status !== 'ERROR') {
    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', row.organization_id)
      .maybeSingle()
    Sentry.captureMessage('Nota fiscal com erro no Asaas', {
      level: 'warning',
      extra: { organizacao: row.organization_id, nota: invoice.id },
    })
    await sendToAll(
      platformAdminEmails(),
      invoiceErrorPlatformEmail({
        orgName: org?.name ?? 'Empresa',
        value: row.value,
        description: invoice.statusDescription ?? null,
      }),
      'Aviso de nota fiscal com erro',
      row.organization_id
    )
  }
  return 'saved'
}
