'use server'

import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, supportInboxEmail, supportRequestEmail } from '@/lib/email'
import { supportKindLabel } from './support-kinds'

export type SupportFormState = {
  ok: boolean
  message?: string
  fieldErrors?: Partial<Record<'kind' | 'message', string[]>>
  /** Muda a cada envio bem-sucedido — o formulário usa para se limpar. */
  sentAt?: number
}

const schema = z.object({
  kind: z.enum(['duvida', 'problema', 'sugestao'], { message: 'Escolha o tipo da mensagem.' }),
  message: z
    .string()
    .trim()
    .min(10, 'Escreva pelo menos 10 caracteres.')
    .max(5000, 'A mensagem pode ter até 5.000 caracteres.'),
})

/** Limite por pessoa, para um formulário travado não esgotar a cota de e-mails. */
const MAX_PER_HOUR = 5

const ROLE_LABEL: Record<string, string> = {
  owner: 'Dono',
  admin: 'Administrador',
  member: 'Membro',
}

export async function sendSupportRequestAction(
  _prev: SupportFormState,
  formData: FormData
): Promise<SupportFormState> {
  const { organization, user, role } = await requireOrganization()

  const parsed = schema.safeParse({
    kind: formData.get('kind'),
    message: formData.get('message'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Corrija os campos destacados.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const since = new Date(Date.now() - 60 * 60_000).toISOString()
  const { count } = await supabase
    .from('support_requests')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organization.id)
    .eq('created_by', user.id)
    .gte('created_at', since)
  if ((count ?? 0) >= MAX_PER_HOUR) {
    return {
      ok: false,
      message: 'Você já enviou várias mensagens na última hora. Aguarde um pouco para enviar outra.',
    }
  }

  const { data: request, error } = await supabase
    .from('support_requests')
    .insert({
      organization_id: organization.id,
      created_by: user.id,
      kind: parsed.data.kind,
      message: parsed.data.message,
    })
    .select('id, created_at')
    .single()
  if (error || !request) {
    Sentry.captureException(error ?? new Error('support_requests: insert sem retorno'))
    return { ok: false, message: 'Não foi possível enviar agora. Tente de novo em instantes.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .maybeSingle()
  const userEmail = user.email ?? ''

  const tpl = supportRequestEmail({
    kindLabel: supportKindLabel(parsed.data.kind),
    message: parsed.data.message,
    userName: profile?.full_name || userEmail || 'Usuário',
    userEmail,
    orgName: organization.name,
    role: ROLE_LABEL[role] ?? role,
    requestId: request.id,
    createdAt: request.created_at,
  })
  const res = await sendEmail({
    to: supportInboxEmail(),
    subject: tpl.subject,
    html: tpl.html,
    replyTo: userEmail || undefined,
  })

  const emailStatus = res.ok ? 'sent' : res.skipped ? 'skipped' : 'failed'
  await supabase
    .from('support_requests')
    .update({ email_status: emailStatus })
    .eq('id', request.id)
    .eq('organization_id', organization.id)

  // O pedido já está salvo; o aviso é para ninguém ficar sem resposta.
  // Só ids — nome, e-mail e mensagem não saem do Supabase.
  if (!res.ok) {
    Sentry.captureMessage('Pedido de suporte salvo, mas o e-mail não foi enviado', {
      level: 'error',
      fingerprint: ['suporte-falha-envio'],
      extra: {
        pedido: request.id,
        organizacao: organization.id,
        status: emailStatus,
        motivo: res.error.replace(/[^\s@<>]+@[^\s@<>]+/g, '[e-mail]'),
      },
    })
    await Sentry.flush(2000)
  }

  revalidatePath('/suporte')
  return { ok: true, sentAt: Date.now() }
}
