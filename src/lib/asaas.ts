// Cliente da API v3 do Asaas (cobrança das assinaturas). Só no servidor: usa a
// ASAAS_API_KEY, que nunca tem prefixo NEXT_PUBLIC_.
//
// A chave define o ambiente: `$aact_hmlg_` = sandbox (testes), `$aact_prod_` =
// produção. Na Vercel, Preview tem a chave do sandbox e Production a de produção.
// Docs: https://docs.asaas.com

const SANDBOX_URL = 'https://api-sandbox.asaas.com/v3'
const PRODUCTION_URL = 'https://api.asaas.com/v3'

export class AsaasError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'AsaasError'
  }
}

function apiKey(): string | null {
  // Tira BOM/espaços que o PowerShell às vezes grava junto (veja src/lib/supabase/env.ts).
  const key = process.env.ASAAS_API_KEY?.replace(/^﻿/, '').trim()
  return key || null
}

export function asaasConfigured(): boolean {
  return apiKey() !== null
}

export function asaasEnvironment(): 'sandbox' | 'production' | null {
  const key = apiKey()
  if (!key) return null
  return key.startsWith('$aact_prod_') ? 'production' : 'sandbox'
}

async function asaas<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const key = apiKey()
  if (!key) throw new AsaasError('ASAAS_API_KEY não configurada', 500)
  const base = asaasEnvironment() === 'production' ? PRODUCTION_URL : SANDBOX_URL

  const res = await fetch(`${base}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      access_token: key,
      'Content-Type': 'application/json',
      // Obrigatório para contas criadas a partir de 13/06/2024.
      'User-Agent': 'Estokei',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  })

  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    const description: string | undefined = data?.errors?.[0]?.description
    throw new AsaasError(description ?? `Asaas respondeu ${res.status}`, res.status)
  }
  return data as T
}

// ---- Tipos (só os campos que usamos) -------------------------------------------

export type AsaasPayment = {
  id: string
  status: string
  value: number
  billingType: string | null
  dueDate: string
  paymentDate?: string | null
  clientPaymentDate?: string | null
  confirmedDate?: string | null
  invoiceUrl?: string | null
  subscription?: string | null
  deleted?: boolean
}

export type AsaasSubscription = {
  id: string
  status: string
  deleted?: boolean
  externalReference?: string | null
}

type CustomerInput = { name: string; cpfCnpj: string; email: string; externalReference: string }

// ---- Clientes ----------------------------------------------------------------

export function createCustomer(input: CustomerInput) {
  return asaas<{ id: string }>('/customers', { method: 'POST', body: input })
}

export function updateCustomer(id: string, input: CustomerInput) {
  return asaas<{ id: string }>(`/customers/${encodeURIComponent(id)}`, { method: 'PUT', body: input })
}

// ---- Assinaturas -------------------------------------------------------------

export function createSubscription(input: {
  customer: string
  value: number
  cycle: 'monthly' | 'yearly'
  nextDueDate: string
  description: string
  externalReference: string
}) {
  return asaas<AsaasSubscription>('/subscriptions', {
    method: 'POST',
    body: {
      customer: input.customer,
      // UNDEFINED: o cliente escolhe Pix, boleto ou cartão na página da fatura.
      billingType: 'UNDEFINED',
      value: input.value,
      nextDueDate: input.nextDueDate,
      cycle: input.cycle === 'yearly' ? 'YEARLY' : 'MONTHLY',
      description: input.description,
      externalReference: input.externalReference,
    },
  })
}

/** Remove a assinatura; o Asaas apaga junto as cobranças pendentes ou vencidas. */
export function deleteSubscription(id: string) {
  return asaas<{ deleted: boolean }>(`/subscriptions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function listSubscriptionPayments(id: string): Promise<AsaasPayment[]> {
  const res = await asaas<{ data: AsaasPayment[] }>(
    `/subscriptions/${encodeURIComponent(id)}/payments?limit=100`
  )
  return res.data ?? []
}

// ---- Nota fiscal (NFS-e) -----------------------------------------------------

export type AsaasInvoice = {
  id: string
  status: string
  /** Id da cobrança que gerou a nota. */
  payment?: string | null
  number?: string | null
  pdfUrl?: string | null
  statusDescription?: string | null
}

/** A assinatura já emite nota sozinha? (404 = ainda não configurada) */
export async function hasInvoiceSettings(subscriptionId: string): Promise<boolean> {
  try {
    await asaas(`/subscriptions/${encodeURIComponent(subscriptionId)}/invoiceSettings`)
    return true
  } catch (err) {
    if (err instanceof AsaasError && err.status === 404) return false
    throw err
  }
}

/** Liga a nota automática da assinatura (corpo de invoiceSettingsBody, src/lib/nfse.ts). */
export function createInvoiceSettings(subscriptionId: string, body: object) {
  return asaas(`/subscriptions/${encodeURIComponent(subscriptionId)}/invoiceSettings`, {
    method: 'POST',
    body,
  })
}

// ---- Webhook -----------------------------------------------------------------

export const WEBHOOK_NAME = 'Estokei'

/** Eventos que o Estokei acompanha (cobranças e assinaturas). */
export const WEBHOOK_EVENTS = [
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_RESTORED',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_DUNNING_RECEIVED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_DELETED',
  'SUBSCRIPTION_INACTIVATED',
  // Nota fiscal (src/lib/nfse.ts). Webhook cadastrado antes de out/2026 precisa
  // ser reconfigurado na /plataforma para receber estes.
  'INVOICE_CREATED',
  'INVOICE_UPDATED',
  'INVOICE_SYNCHRONIZED',
  'INVOICE_AUTHORIZED',
  'INVOICE_PROCESSING_CANCELLATION',
  'INVOICE_CANCELED',
  'INVOICE_CANCELLATION_DENIED',
  'INVOICE_ERROR',
]

export type AsaasWebhook = {
  id: string
  name: string
  url: string
  enabled: boolean
  interrupted: boolean
}

export async function listWebhooks(): Promise<AsaasWebhook[]> {
  const res = await asaas<{ data: AsaasWebhook[] }>('/webhooks?limit=10')
  return res.data ?? []
}

export function saveWebhook(
  input: { url: string; email: string; authToken: string },
  existingId?: string
) {
  const body = {
    name: WEBHOOK_NAME,
    url: input.url,
    email: input.email,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken: input.authToken,
    // Em ordem: uma cobrança não "volta" para um status antigo.
    sendType: 'SEQUENTIALLY',
    events: WEBHOOK_EVENTS,
  }
  return existingId
    ? asaas<AsaasWebhook>(`/webhooks/${encodeURIComponent(existingId)}`, { method: 'PUT', body })
    : asaas<AsaasWebhook>('/webhooks', { method: 'POST', body })
}
