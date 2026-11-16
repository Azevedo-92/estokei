import * as Sentry from '@sentry/nextjs'
import { createServiceClient } from '@/lib/supabase/server'
import type { AsaasInvoice, AsaasPayment, AsaasSubscription } from '@/lib/asaas'
import { handleInvoiceEvent, handlePaymentEvent, handleSubscriptionEvent } from '@/lib/billing-sync'

export const dynamic = 'force-dynamic'

// Webhook do Asaas: cada mudança de cobrança ou assinatura chega aqui (em ordem,
// "SEQUENTIALLY"). Rotas de API ficam fora do middleware, então esta se
// autentica sozinha: o Asaas manda no cabeçalho `asaas-access-token` o token
// cadastrado no webhook, que é a ASAAS_WEBHOOK_TOKEN. Sem a variável, falha
// fechado. O webhook é cadastrado pela tela /plataforma.
//
// O Asaas só considera entregue com HTTP 200 (em até 10 s) e pode mandar o mesmo
// evento mais de uma vez: o tratamento é idempotente (grava o estado da cobrança
// e só age na passagem para "paga"). Depois de 15 falhas seguidas ele pausa a fila.

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

type WebhookEvent = {
  id?: string
  event?: string
  payment?: AsaasPayment
  subscription?: AsaasSubscription
  invoice?: AsaasInvoice
}

export async function POST(request: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim()
  if (!expected) {
    console.error('[webhooks/asaas] ASAAS_WEBHOOK_TOKEN ausente - rota desabilitada')
    return new Response('Unauthorized', { status: 401 })
  }
  const token = request.headers.get('asaas-access-token') ?? ''
  if (!safeEqual(token, expected)) return new Response('Unauthorized', { status: 401 })

  let body: WebhookEvent
  try {
    body = (await request.json()) as WebhookEvent
  } catch {
    // Corpo inválido não melhora com nova tentativa: confirma para não travar a fila.
    return Response.json({ ok: true, ignored: 'corpo inválido' })
  }

  const admin = createServiceClient()
  try {
    if (body.event?.startsWith('PAYMENT_') && body.payment) {
      const deleted =
        body.event === 'PAYMENT_DELETED' ? true : body.event === 'PAYMENT_RESTORED' ? false : body.payment.deleted
      const result = await handlePaymentEvent(admin, { ...body.payment, deleted })
      return Response.json({ ok: true, result })
    }
    if (body.event?.startsWith('SUBSCRIPTION_') && body.subscription) {
      await handleSubscriptionEvent(admin, body.subscription)
      return Response.json({ ok: true })
    }
    if (body.event?.startsWith('INVOICE_') && body.invoice) {
      const result = await handleInvoiceEvent(admin, body.invoice)
      return Response.json({ ok: true, result })
    }
    return Response.json({ ok: true, ignored: body.event ?? 'sem evento' })
  } catch (err) {
    // Erro nosso (ex.: banco fora): 500 faz o Asaas tentar de novo mais tarde.
    Sentry.captureException(err, { extra: { evento: body.event, id: body.id } })
    return new Response('Erro ao processar', { status: 500 })
  }
}
