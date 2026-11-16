// Regras puras dos orçamentos (sem acesso ao banco). Os preços e a validação
// de verdade ficam nas funções save_quote/convert_quote do banco.

import { formatCurrencyBRL } from './utils'
import { formatQuantity } from './stock'

export const DEFAULT_VALIDITY_DAYS = 7

export type QuoteStatus = 'aberto' | 'convertido' | 'cancelado'
/** Situação mostrada na tela: "vencido" é um orçamento aberto fora da validade. */
export type QuoteDisplayStatus = QuoteStatus | 'vencido'

export const QUOTE_STATUS_LABEL: Record<QuoteDisplayStatus, string> = {
  aberto: 'Em aberto',
  vencido: 'Vencido',
  convertido: 'Virou venda',
  cancelado: 'Cancelado',
}

export const QUOTE_STATUS_CHIP: Record<QuoteDisplayStatus, string> = {
  aberto: 'bg-sky-100 text-sky-800 border-sky-200',
  vencido: 'bg-amber-100 text-amber-800 border-amber-200',
  convertido: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelado: 'bg-muted text-muted-foreground border-border',
}

/** `today` e `validUntil` em AAAA-MM-DD (calendário de Brasília). */
export function quoteDisplayStatus(status: string, validUntil: string, today: string): QuoteDisplayStatus {
  if (status === 'aberto' && validUntil < today) return 'vencido'
  return (status as QuoteStatus) in QUOTE_STATUS_LABEL ? (status as QuoteStatus) : 'aberto'
}

/** Soma dias a uma data AAAA-MM-DD sem depender do fuso da máquina. */
export function addDaysISO(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

/** Telefone para o link do WhatsApp: só dígitos, com DDI 55. Null se não der. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const d = (phone ?? '').replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return `55${d}`
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
  return null
}

export type QuoteForMessage = {
  number: number
  storeName: string
  customerName: string | null
  validUntilBR: string
  items: { name: string; quantity: number; unit: string; total: number }[]
  discount: number
  total: number
}

/** Texto do orçamento para mandar pelo WhatsApp (o PDF vai junto, baixado). */
export function quoteWhatsappText(q: QuoteForMessage): string {
  const lines = [
    `*Orçamento #${q.number} — ${q.storeName}*`,
    q.customerName ? `Cliente: ${q.customerName}` : null,
    '',
    ...q.items.map((i) => `• ${formatQuantity(i.quantity)} ${i.unit} ${i.name} — ${formatCurrencyBRL(i.total)}`),
    '',
    q.discount > 0 ? `Desconto: ${formatCurrencyBRL(q.discount)}` : null,
    `*Total: ${formatCurrencyBRL(q.total)}*`,
    `Válido até ${q.validUntilBR}.`,
  ]
  return lines.filter((l) => l !== null).join('\n')
}
