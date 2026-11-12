import * as Sentry from '@sentry/nextjs'
import { createServiceClient } from '@/lib/supabase/server'
import { suspendOverdueOrganizations } from '@/lib/billing-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Comparacao em tempo constante: nao vaza o segredo pelo tempo de resposta.
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Rotina diária (Vercel Cron, 12h UTC = 9h de Brasília):
 * 1. suspende empresas com mensalidade vencida há 10 dias ou mais;
 * 2. aplica os prazos de guarda da Política de Privacidade.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET

  // Falha fechado: esta rota usa service_role (ignora o RLS). Sem segredo
  // configurado, ela simplesmente nao roda.
  if (!expected) {
    console.error('[cron/diario] CRON_SECRET ausente - rota desabilitada')
    return new Response('Unauthorized', { status: 401 })
  }

  // A Vercel Cron envia `Authorization: Bearer $CRON_SECRET` automaticamente.
  const authHeader = request.headers.get('authorization') ?? ''
  if (!safeEqual(authHeader, `Bearer ${expected}`)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()

  let suspendedForPayment = 0
  try {
    suspendedForPayment = (await suspendOverdueOrganizations(supabase)).length
  } catch (err) {
    Sentry.captureException(err)
  }

  // Prazo de guarda prometido na Política de Privacidade (/privacidade):
  // mensagens de suporte por 24 meses.
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 24)
  const { error: retentionError } = await supabase
    .from('support_requests')
    .delete()
    .lt('created_at', cutoff.toISOString())
  if (retentionError) Sentry.captureException(retentionError)

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    suspended_for_payment: suspendedForPayment,
  })
}
