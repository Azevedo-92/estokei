'use server'

import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { loadMemberships, requireUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { isPlatformAdmin, type OrgStatus } from '@/lib/platform'
import { newOrganizationEmail, organizationActivatedEmail, sendEmail } from '@/lib/email'
import { WEBHOOK_NAME, asaasConfigured, listWebhooks, saveWebhook } from '@/lib/asaas'
import { enableSubscriptionInvoices, invoiceDescription, ownerEmails } from '@/lib/billing-sync'
import { nfseSettings } from '@/lib/nfse'

// Exceção documentada à regra do service role: só o dono da plataforma
// (PLATFORM_ADMIN_EMAILS) chega a estas ações, e cada uma confere isso antes.

const statusSchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(['active', 'pending', 'suspended']),
  reason: z.string().trim().max(200, 'O motivo pode ter até 200 caracteres.').optional(),
})

export async function setOrganizationStatusAction(
  organizationId: string,
  status: OrgStatus,
  reason?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireUser()
  if (!isPlatformAdmin(user.email)) return { ok: false, message: 'Acesso restrito.' }

  const parsed = statusSchema.safeParse({ organizationId, status, reason })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }
  if (parsed.data.status === 'suspended' && !parsed.data.reason) {
    return { ok: false, message: 'Informe o motivo da suspensão.' }
  }

  const admin = createServiceClient()
  const { data: before } = await admin
    .from('organizations')
    .select('name, status')
    .eq('id', parsed.data.organizationId)
    .maybeSingle()
  if (!before) return { ok: false, message: 'Empresa não encontrada.' }
  if (before.status === parsed.data.status) return { ok: true }

  const { error } = await admin
    .from('organizations')
    .update({
      status: parsed.data.status,
      status_changed_at: new Date().toISOString(),
      // Motivo só vale para suspensão; liberar de novo apaga.
      status_reason: parsed.data.status === 'suspended' ? parsed.data.reason : null,
    })
    .eq('id', parsed.data.organizationId)
  if (error) return { ok: false, message: error.message }

  // Liberou uma empresa nova: avisa os donos por e-mail.
  if (before.status === 'pending' && parsed.data.status === 'active') {
    const emails = await ownerEmails(admin, parsed.data.organizationId)
    if (emails.length > 0) {
      const tpl = organizationActivatedEmail({ orgName: before.name })
      const res = await sendEmail({ to: emails[0], cc: emails.slice(1), ...tpl })
      if (!res.ok && !res.skipped) {
        Sentry.captureMessage('Aviso de empresa liberada não foi enviado', {
          level: 'warning',
          extra: { organizacao: parsed.data.organizationId },
        })
      }
    }
  }

  revalidatePath('/plataforma')
  return { ok: true }
}

/**
 * Chamada logo depois de criar uma empresa pelo cadastro: avisa o dono da
 * plataforma por e-mail que há uma empresa aguardando liberação. Só age sobre
 * empresa recém-criada (até 1 hora) e ainda pendente, da qual quem chama é dono.
 */
export async function notifyNewOrganizationAction(): Promise<void> {
  const { user, memberships } = await loadMemberships()
  const created = memberships.find(
    (m) =>
      m.role === 'owner' &&
      m.organizations!.status === 'pending' &&
      Date.now() - new Date(m.organizations!.created_at).getTime() < 60 * 60_000
  )
  if (!created) return

  const recipients = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
  if (recipients.length === 0) return

  const tpl = newOrganizationEmail({
    orgName: created.organizations!.name,
    ownerName: (user.user_metadata?.full_name as string | undefined) || user.email || 'Sem nome',
    ownerEmail: user.email ?? '',
  })
  const res = await sendEmail({ to: recipients[0], cc: recipients.slice(1), ...tpl })
  if (!res.ok && !res.skipped) {
    Sentry.captureMessage('Aviso de nova empresa não foi enviado', {
      level: 'warning',
      extra: { organizacao: created.organization_id },
    })
  }
}

/**
 * Cadastra (ou atualiza) no Asaas o webhook que avisa o Estokei de cada
 * pagamento. Usa o endereço do site em que o botão foi clicado — por isso não
 * funciona em localhost — e o token ASAAS_WEBHOOK_TOKEN, que o Asaas devolve no
 * cabeçalho `asaas-access-token`. No site de testes (protegido pela Vercel), o
 * endereço leva o segredo de "Protection Bypass for Automation".
 */
export async function configureAsaasWebhookAction(): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser()
  if (!isPlatformAdmin(user.email)) return { ok: false, message: 'Acesso restrito.' }
  if (!asaasConfigured()) return { ok: false, message: 'A chave do Asaas (ASAAS_API_KEY) não está configurada neste ambiente.' }

  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim()
  if (!token || token.length < 32) {
    return { ok: false, message: 'O token do webhook (ASAAS_WEBHOOK_TOKEN) não está configurado neste ambiente.' }
  }

  const host = (await headers()).get('host') ?? ''
  if (!host || host.startsWith('localhost') || host.startsWith('127.')) {
    return { ok: false, message: 'Configure pelo site publicado: o Asaas não alcança o seu computador.' }
  }
  let url = `https://${host}/api/webhooks/asaas`
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (process.env.VERCEL_ENV === 'preview') {
    if (!bypass) {
      return { ok: false, message: 'O site de testes precisa do "Protection Bypass for Automation" ligado na Vercel.' }
    }
    url += `?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`
  }

  try {
    const existing = (await listWebhooks()).find((w) => w.name === WEBHOOK_NAME)
    await saveWebhook({ url, email: user.email!, authToken: token }, existing?.id)
    revalidatePath('/plataforma')
    return { ok: true, message: existing ? 'Webhook do Asaas atualizado.' : 'Webhook do Asaas cadastrado.' }
  } catch (err) {
    Sentry.captureException(err)
    return { ok: false, message: err instanceof Error ? err.message : 'Não foi possível falar com o Asaas.' }
  }
}

/**
 * Liga a nota fiscal automática nas assinaturas ativas que ainda não emitem
 * nota (criadas antes de ASAAS_NFSE_SETTINGS existir, ou em que a configuração
 * falhou ao contratar). Assinaturas novas já nascem com a nota ligada.
 */
export async function enableInvoicesForAllAction(): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser()
  if (!isPlatformAdmin(user.email)) return { ok: false, message: 'Acesso restrito.' }
  if (!nfseSettings()) {
    return { ok: false, message: 'A nota automática não está configurada neste ambiente (ASAAS_NFSE_SETTINGS).' }
  }

  const admin = createServiceClient()
  const { data: subs, error } = await admin
    .from('subscriptions')
    .select('organization_id, asaas_subscription_id, plan, cycle')
    .is('canceled_at', null)
    .is('nfse_configured_at', null)
  if (error) return { ok: false, message: error.message }

  let done = 0
  const failed: string[] = []
  for (const s of subs ?? []) {
    try {
      await enableSubscriptionInvoices(admin, s.asaas_subscription_id, invoiceDescription(s.plan, s.cycle))
      done++
    } catch (err) {
      Sentry.captureException(err, { extra: { organizacao: s.organization_id, etapa: 'nota fiscal' } })
      failed.push(err instanceof Error ? err.message : 'erro desconhecido')
    }
  }

  revalidatePath('/plataforma')
  if (failed.length > 0) {
    return { ok: false, message: `Nota ligada em ${done}; ${failed.length} falharam: ${failed[0]}` }
  }
  return { ok: true, message: done === 0 ? 'Todas as assinaturas já emitem nota.' : `Nota automática ligada em ${done} assinatura(s).` }
}
