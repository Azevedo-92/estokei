import { Resend } from 'resend'
import { TIMEZONE } from '@/lib/utils'

let cachedClient: Resend | null = null

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return null
  if (!cachedClient) cachedClient = new Resend(key)
  return cachedClient
}

function fromAddress(): string {
  const raw = process.env.RESEND_FROM_EMAIL?.trim()
  if (raw) return raw
  // Fallback do onboarding do Resend — só envia pra caixa do próprio dono da conta
  return 'Estokei <onboarding@resend.dev>'
}

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string; skipped?: boolean }

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  /** Para onde vai a resposta, quando não deve ser o remetente. */
  replyTo?: string
  /** Cópia visível (ex.: administradores da empresa). */
  cc?: string[]
}): Promise<SendResult> {
  const client = getClient()
  if (!client) {
    return { ok: false, error: 'RESEND_API_KEY não configurada', skipped: true }
  }
  try {
    const res = await client.emails.send({
      from: fromAddress(),
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
      ...(params.cc && params.cc.length > 0 ? { cc: params.cc } : {}),
    })
    if (res.error) return { ok: false, error: res.error.message }
    return { ok: true, id: res.data?.id ?? '' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' }
  }
}

// ---- Templates ---------------------------------------------------------------

function logoUrl(): string {
  return `${appUrl()}/api/brand/logo?v=4`
}

const DEFAULT_FOOTER =
  'Você está recebendo este e-mail porque faz parte de uma equipe no Estokei.'

function baseTemplate(
  title: string,
  body: string,
  ctaHref: string,
  ctaLabel: string,
  footer: string = DEFAULT_FOOTER
): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <div style="padding:20px 28px;border-bottom:1px solid #f1f5f9;">
      <img src="${logoUrl()}" alt="Estokei" width="176" height="36" style="display:block;border:0;outline:none;text-decoration:none;height:36px;width:176px;" />
    </div>
    <div style="padding:24px 28px;">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;color:#0f172a;">${escapeHtml(title)}</h1>
      <div style="font-size:14px;line-height:1.6;color:#334155;">${body}</div>
      <div style="margin-top:24px;">
        <a href="${ctaHref}" style="display:inline-block;padding:11px 18px;background:#ea580c;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">${escapeHtml(ctaLabel)}</a>
      </div>
    </div>
    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;">
      ${escapeHtml(footer)}
    </div>
  </div>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://estokei.vercel.app').replace(
    /\/$/,
    ''
  )
}

// -----------------------------------------------------------------------------
// Suporte
// -----------------------------------------------------------------------------

/** Caixa que recebe os pedidos da página /suporte. */
export function supportInboxEmail(): string {
  return process.env.SUPPORT_INBOX_EMAIL?.trim() || 'contato@clientcycle.com.br'
}

export function supportRequestEmail(input: {
  kindLabel: string
  message: string
  userName: string
  userEmail: string
  orgName: string
  role: string
  requestId: string
  createdAt: string
}): { subject: string; html: string } {
  const sentAt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  }).format(new Date(input.createdAt))
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:4px 0;color:#0f172a;">${value}</td></tr>`
  const title = `${input.kindLabel} — ${input.orgName}`
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <div style="padding:24px 28px;">
      <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Pedido de suporte · ${escapeHtml(input.kindLabel)}</div>
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;color:#0f172a;">${escapeHtml(input.orgName)}</h1>
      <table style="font-size:14px;line-height:1.5;border-collapse:collapse;">
        ${row('De', `${escapeHtml(input.userName)} &lt;${escapeHtml(input.userEmail)}&gt;`)}
        ${row('Papel', escapeHtml(input.role))}
        ${row('Enviado em', `${sentAt} (Brasília)`)}
      </table>
      <div style="margin-top:16px;padding:14px 16px;background:#f1f5f9;border-radius:8px;font-size:14px;line-height:1.6;color:#0f172a;white-space:pre-wrap;">${escapeHtml(input.message)}</div>
    </div>
    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;">
      Responda este e-mail para falar direto com ${escapeHtml(input.userName)}. Pedido ${escapeHtml(input.requestId)}.
    </div>
  </div>
</body>
</html>`
  return { subject: `[Suporte] ${title}`, html }
}

// -----------------------------------------------------------------------------
// Plataforma (liberação de empresas)
// -----------------------------------------------------------------------------

/** Para o dono da plataforma: alguém criou uma empresa e aguarda liberação. */
export function newOrganizationEmail(input: {
  orgName: string
  ownerName: string
  ownerEmail: string
}): { subject: string; html: string } {
  const body = `
    <p>A empresa <strong>${escapeHtml(input.orgName)}</strong> acabou de se cadastrar no
    Estokei e está <strong>aguardando liberação</strong>.</p>
    <p>Responsável: ${escapeHtml(input.ownerName)} &lt;${escapeHtml(input.ownerEmail)}&gt;</p>
    <p>A pessoa vê uma tela pedindo para falar com você no WhatsApp. Depois de combinar o
    plano, libere o acesso na tela da plataforma.</p>
  `
  return {
    subject: `[Nova empresa] ${input.orgName} aguardando liberação`,
    html: baseTemplate(
      `Nova empresa: ${input.orgName}`,
      body,
      `${appUrl()}/plataforma`,
      'Abrir a plataforma',
      'Aviso automático da plataforma Estokei para o administrador da plataforma.'
    ),
  }
}

/** Para o dono da empresa: o acesso foi liberado. */
export function organizationActivatedEmail(input: { orgName: string }): {
  subject: string
  html: string
} {
  const body = `
    <p>O acesso da <strong>${escapeHtml(input.orgName)}</strong> ao Estokei foi
    <strong>liberado</strong>. Sua equipe já pode entrar e começar a usar.</p>
    <p>Dica: em <strong>Equipe</strong> você cadastra as pessoas que vão usar o sistema
    (caixa, vendedores e administradores).</p>
  `
  return {
    subject: `Acesso liberado: ${input.orgName} no Estokei`,
    html: baseTemplate(
      'Seu acesso foi liberado',
      body,
      `${appUrl()}/painel`,
      'Entrar no Estokei',
      'Você está recebendo este e-mail porque é responsável por esta empresa no Estokei.'
    ),
  }
}

// -----------------------------------------------------------------------------
// Cobrança (Asaas)
// -----------------------------------------------------------------------------

/** Para o dono da plataforma: empresa aguardando liberação pagou o plano. */
export function paymentReceivedPlatformEmail(input: {
  orgName: string
  planLabel: string
  value: number
}): { subject: string; html: string } {
  const value = input.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const body = `
    <p>A empresa <strong>${escapeHtml(input.orgName)}</strong> pagou o plano
    <strong>${escapeHtml(input.planLabel)}</strong> (${escapeHtml(value)}).</p>
    <p>Ela continua <strong>aguardando liberação</strong>: confira o cadastro e libere o
    acesso na tela da plataforma.</p>
  `
  return {
    subject: `[Pagamento] ${input.orgName} pagou — liberar acesso`,
    html: baseTemplate(
      `Pagamento recebido: ${input.orgName}`,
      body,
      `${appUrl()}/plataforma`,
      'Abrir a plataforma',
      'Aviso automático da plataforma Estokei para o administrador da plataforma.'
    ),
  }
}

const BILLING_FOOTER =
  'Você está recebendo este e-mail porque é responsável por esta empresa no Estokei.'

/** Para os donos: acesso suspenso por cobrança vencida. */
export function billingSuspendedEmail(input: { orgName: string; invoiceUrl: string | null }): {
  subject: string
  html: string
} {
  const body = `
    <p>O acesso da <strong>${escapeHtml(input.orgName)}</strong> ao Estokei foi
    <strong>suspenso</strong> porque há uma cobrança da assinatura vencida há mais de 10 dias.</p>
    <p>Os dados continuam guardados. Assim que o pagamento for confirmado, o acesso volta
    sozinho — não é preciso falar com a gente.</p>
  `
  return {
    subject: `Acesso suspenso: ${input.orgName} no Estokei`,
    html: baseTemplate(
      'Acesso suspenso por falta de pagamento',
      body,
      input.invoiceUrl ?? `${appUrl()}/aguardando-liberacao`,
      'Pagar agora',
      BILLING_FOOTER
    ),
  }
}

/** Para os donos: pagamento confirmado depois da suspensão, acesso de volta. */
export function billingReactivatedEmail(input: { orgName: string }): {
  subject: string
  html: string
} {
  const body = `
    <p>Recebemos o pagamento e o acesso da <strong>${escapeHtml(input.orgName)}</strong> ao
    Estokei foi <strong>reativado</strong>. Sua equipe já pode entrar normalmente.</p>
  `
  return {
    subject: `Acesso reativado: ${input.orgName} no Estokei`,
    html: baseTemplate('Acesso reativado', body, `${appUrl()}/painel`, 'Entrar no Estokei', BILLING_FOOTER),
  }
}

/** Para o dono da plataforma: a prefeitura recusou a nota de um pagamento. */
export function invoiceErrorPlatformEmail(input: {
  orgName: string
  value: number
  description: string | null
}): { subject: string; html: string } {
  const value = input.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const body = `
    <p>A nota fiscal do pagamento de <strong>${escapeHtml(value)}</strong> da empresa
    <strong>${escapeHtml(input.orgName)}</strong> não foi emitida.</p>
    ${input.description ? `<p>Motivo informado: ${escapeHtml(input.description)}</p>` : ''}
    <p>Abra o painel do Asaas, em Notas fiscais, corrija o problema e emita de novo.</p>
  `
  return {
    subject: `[Nota fiscal] Erro na nota de ${input.orgName}`,
    html: baseTemplate(
      `Nota fiscal com erro: ${input.orgName}`,
      body,
      'https://www.asaas.com',
      'Abrir o Asaas',
      'Aviso automático da plataforma Estokei para o administrador da plataforma.'
    ),
  }
}
