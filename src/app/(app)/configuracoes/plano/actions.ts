'use server'

import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { loadMemberships } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { getPlan, planPrice, type BillingCycle } from '@/lib/plans'
import { isPaidStatus, isValidDocument, normalizeDocument } from '@/lib/billing'
import {
  AsaasError,
  asaasConfigured,
  createCustomer,
  createSubscription,
  deleteSubscription,
  listSubscriptionPayments,
  updateCustomer,
} from '@/lib/asaas'
import { enableSubscriptionInvoices, invoiceDescription, savePayment } from '@/lib/billing-sync'
import { todayISO } from '@/lib/utils'

// Exceção documentada à regra do service role: subscriptions e
// subscription_payments não têm política de escrita para usuários. Esta action
// confere que quem chama é dono/admin da empresa antes de gravar.

export type CheckoutState = {
  ok: boolean
  message?: string
  fieldErrors?: Record<string, string[] | undefined>
  /** Página de pagamento do Asaas (Pix, boleto ou cartão). */
  invoiceUrl?: string
}

const checkoutSchema = z.object({
  plan: z.enum(['essencial', 'profissional', 'completo'], { message: 'Escolha um plano.' }),
  cycle: z.enum(['monthly', 'yearly']),
  billingName: z.string().trim().min(2, 'Informe o nome ou a razão social.').max(200),
  billingDocument: z
    .string()
    .transform(normalizeDocument)
    .refine(isValidDocument, 'CPF ou CNPJ inválido.'),
  billingEmail: z.string().trim().email('E-mail inválido.').max(200),
})

export async function startSubscriptionAction(
  _prev: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  // Vale para empresa liberada, aguardando liberação ou suspensa — por isso
  // loadMemberships, e não requireOrganization (que redireciona as não liberadas).
  const { user, current } = await loadMemberships()
  if (!current) return { ok: false, message: 'Empresa não encontrada.' }
  if (!canManageTeam(current.role)) {
    return { ok: false, message: 'Só o dono ou administradores da empresa contratam o plano.' }
  }
  if (!asaasConfigured()) {
    return { ok: false, message: 'O pagamento pelo sistema ainda não está disponível. Fale com a gente pelo WhatsApp.' }
  }

  const parsed = checkoutSchema.safeParse({
    plan: formData.get('plan'),
    cycle: formData.get('cycle'),
    billingName: formData.get('billingName') ?? '',
    billingDocument: formData.get('billingDocument') ?? '',
    billingEmail: formData.get('billingEmail') ?? '',
  })
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Corrija os campos destacados.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const orgId = current.organization_id
  const plan = getPlan(parsed.data.plan)!
  const cycle = parsed.data.cycle as BillingCycle
  const value = planPrice(plan, cycle)
  const admin = createServiceClient()

  const { data: existing } = await admin
    .from('subscriptions')
    .select('asaas_customer_id, asaas_subscription_id, billing_document, canceled_at')
    .eq('organization_id', orgId)
    .maybeSingle()

  // Já tem assinatura: só dá para trocar enquanto nada foi pago (a cobrança em
  // aberto é cancelada junto). Depois de pago, troca de plano é com a gente.
  if (existing && !existing.canceled_at) {
    const { data: paid } = await admin
      .from('subscription_payments')
      .select('status')
      .eq('organization_id', orgId)
      .eq('deleted', false)
    if ((paid ?? []).some((p) => isPaidStatus(p.status))) {
      return {
        ok: false,
        message: 'Sua assinatura já está ativa. Para trocar de plano, fale com a gente pelo Suporte ou WhatsApp.',
      }
    }
  }

  try {
    if (existing && !existing.canceled_at) {
      await deleteSubscription(existing.asaas_subscription_id)
      await admin
        .from('subscription_payments')
        .update({ deleted: true })
        .eq('asaas_subscription_id', existing.asaas_subscription_id)
    }

    // Reaproveita o cliente no Asaas se o documento é o mesmo.
    const customerInput = {
      name: parsed.data.billingName,
      cpfCnpj: parsed.data.billingDocument,
      email: parsed.data.billingEmail,
      externalReference: orgId,
    }
    const customerId =
      existing && existing.billing_document === parsed.data.billingDocument
        ? (await updateCustomer(existing.asaas_customer_id, customerInput)).id
        : (await createCustomer(customerInput)).id

    const subscription = await createSubscription({
      customer: customerId,
      value,
      cycle,
      nextDueDate: todayISO(),
      // Mesmo texto da nota fiscal (aprovado pelo contador): o Asaas pode usar a
      // descrição da cobrança na discriminação do serviço.
      description: invoiceDescription(plan.slug, cycle),
      externalReference: orgId,
    })

    const { error } = await admin.from('subscriptions').upsert({
      organization_id: orgId,
      plan: plan.slug,
      cycle,
      value,
      billing_name: parsed.data.billingName,
      billing_document: parsed.data.billingDocument,
      billing_email: parsed.data.billingEmail,
      asaas_customer_id: customerId,
      asaas_subscription_id: subscription.id,
      canceled_at: null,
      created_by: user.id,
    })
    if (error) throw error

    // Nota fiscal automática (se ligada neste ambiente). Falhar aqui não impede
    // o pagamento: a nota sai à mão e a /plataforma mostra a assinatura sem nota.
    try {
      await enableSubscriptionInvoices(admin, subscription.id, invoiceDescription(plan.slug, cycle))
    } catch (nfseErr) {
      Sentry.captureException(nfseErr, { extra: { organizacao: orgId, etapa: 'nota fiscal' } })
    }

    // A primeira cobrança nasce junto com a assinatura; guarda já para mostrar
    // o link de pagamento (o webhook também vai trazê-la).
    const payments = await listSubscriptionPayments(subscription.id)
    for (const p of payments) await savePayment(admin, orgId, subscription.id, p)
    const first = payments.find((p) => p.status === 'PENDING' && p.invoiceUrl) ?? payments[0]

    revalidatePath('/configuracoes/plano')
    revalidatePath('/aguardando-liberacao')
    return { ok: true, invoiceUrl: first?.invoiceUrl ?? undefined }
  } catch (err) {
    if (err instanceof AsaasError && err.status === 400) {
      // Erro de validação do Asaas (ex.: CPF/CNPJ recusado): mensagem dele.
      return { ok: false, message: err.message }
    }
    Sentry.captureException(err, { extra: { organizacao: orgId } })
    return {
      ok: false,
      message: 'Não foi possível gerar a cobrança agora. Tente de novo em alguns minutos ou fale com a gente.',
    }
  }
}
