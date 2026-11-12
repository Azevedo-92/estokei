// Regras puras da cobrança (sem banco nem Asaas), testadas em billing.test.ts.
// A situação da assinatura sai das cobranças guardadas em subscription_payments.

/** Status de cobrança do Asaas que contam como pagos. */
export const PAID_STATUSES = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED']

export function isPaidStatus(status: string): boolean {
  return PAID_STATUSES.includes(status)
}

export function paymentStatusLabel(status: string): string {
  if (isPaidStatus(status)) return 'Paga'
  if (status === 'PENDING') return 'Em aberto'
  if (status === 'OVERDUE') return 'Vencida'
  if (status === 'REFUNDED' || status === 'REFUND_IN_PROGRESS') return 'Estornada'
  return 'Em análise'
}

/** Dias de atraso a partir dos quais a empresa é suspensa automaticamente. */
export const SUSPEND_AFTER_DAYS = 10

/** Motivo gravado na suspensão automática; pagar reativa quem tem esse motivo. */
export const BILLING_SUSPENSION_REASON = 'Pagamento pendente'

export type PaymentRow = {
  id: string
  status: string
  value: number
  due_date: string
  paid_at: string | null
  invoice_url: string | null
  deleted: boolean
}

export type BillingState =
  | { kind: 'none' }
  | { kind: 'canceled' }
  /** Assinatura criada, nenhuma cobrança paga ainda. */
  | { kind: 'awaiting_payment'; payment: PaymentRow | null }
  /** Há cobrança vencida e não paga (a mais antiga). */
  | { kind: 'overdue'; payment: PaymentRow; daysOverdue: number; suspendOn: string }
  /** Em dia; nextPayment é a próxima cobrança em aberto, se já gerada. */
  | { kind: 'active'; nextPayment: PaymentRow | null }

const byDueDate = (a: PaymentRow, b: PaymentRow) => a.due_date.localeCompare(b.due_date)

/** Dias entre duas datas AAAA-MM-DD (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

export function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function billingState(
  subscription: { canceled_at: string | null } | null,
  payments: PaymentRow[],
  today: string
): BillingState {
  if (!subscription) return { kind: 'none' }
  if (subscription.canceled_at) return { kind: 'canceled' }

  const live = payments.filter((p) => !p.deleted).sort(byDueDate)
  const overdue = live.find((p) => p.status === 'OVERDUE')
  if (overdue) {
    return {
      kind: 'overdue',
      payment: overdue,
      daysOverdue: Math.max(0, daysBetween(overdue.due_date, today)),
      suspendOn: addDaysISO(overdue.due_date, SUSPEND_AFTER_DAYS),
    }
  }

  const open = live.find((p) => p.status === 'PENDING') ?? null
  if (!live.some((p) => isPaidStatus(p.status))) return { kind: 'awaiting_payment', payment: open }
  return { kind: 'active', nextPayment: open }
}

export function shouldSuspendForNonPayment(state: BillingState): boolean {
  return state.kind === 'overdue' && state.daysOverdue >= SUSPEND_AFTER_DAYS
}

// ---- CPF / CNPJ ---------------------------------------------------------------

/** Tira pontuação. Mantém letras: o CNPJ pode ser alfanumérico (a partir de 2026). */
export function normalizeDocument(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

function allSame(s: string) {
  return /^(.)\1+$/.test(s)
}

export function isValidCpf(value: string): boolean {
  const d = normalizeDocument(value)
  if (!/^\d{11}$/.test(d) || allSame(d)) return false
  const digit = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return digit(9) === Number(d[9]) && digit(10) === Number(d[10])
}

/** CNPJ numérico ou alfanumérico: cada caractere vale (código ASCII − 48). */
export function isValidCnpj(value: string): boolean {
  const d = normalizeDocument(value)
  if (!/^[0-9A-Z]{12}\d{2}$/.test(d) || allSame(d)) return false
  const val = (c: string) => c.charCodeAt(0) - 48
  const digit = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < len; i++) sum += val(d[i]) * weights[i]
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return digit(12) === Number(d[12]) && digit(13) === Number(d[13])
}

export function isValidDocument(value: string): boolean {
  const d = normalizeDocument(value)
  return d.length === 11 ? isValidCpf(d) : isValidCnpj(d)
}

export function formatDocument(value: string): string {
  const d = normalizeDocument(value)
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5')
  return value
}
