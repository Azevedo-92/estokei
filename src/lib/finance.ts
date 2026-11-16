// Regras puras do financeiro (sem acesso ao banco): parcelas, situação e
// fluxo de caixa. Datas em AAAA-MM-DD (calendário de Brasília).

export type EntryKind = 'receber' | 'pagar'
export type EntryStatus = 'aberto' | 'pago' | 'cancelado'
/** "vencido" não é gravado: é uma conta em aberto com vencimento no passado. */
export type EntryDisplayStatus = EntryStatus | 'vencido'

export const FINANCE_METHODS = ['dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'outro'] as const
export type FinanceMethod = (typeof FINANCE_METHODS)[number]

export const FINANCE_METHOD_LABEL: Record<FinanceMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  outro: 'Outro',
}

export const KIND_LABEL: Record<EntryKind, string> = { receber: 'A receber', pagar: 'A pagar' }

/** Sugestões do campo categoria (o campo aceita qualquer texto). */
export const CATEGORY_SUGGESTIONS: Record<EntryKind, string[]> = {
  receber: ['Vendas', 'Serviços', 'Outras receitas'],
  pagar: ['Fornecedores', 'Aluguel', 'Energia', 'Água', 'Internet e telefone', 'Salários', 'Impostos', 'Frete', 'Manutenção', 'Outras despesas'],
}

export const ENTRY_STATUS_LABEL: Record<EntryKind, Record<EntryDisplayStatus, string>> = {
  receber: { aberto: 'Em aberto', vencido: 'Vencida', pago: 'Recebida', cancelado: 'Cancelada' },
  pagar: { aberto: 'Em aberto', vencido: 'Vencida', pago: 'Paga', cancelado: 'Cancelada' },
}

export const ENTRY_STATUS_CHIP: Record<EntryDisplayStatus, string> = {
  aberto: 'bg-sky-100 text-sky-800 border-sky-200',
  vencido: 'bg-rose-100 text-rose-800 border-rose-200',
  pago: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelado: 'bg-muted text-muted-foreground border-border',
}

export function entryDisplayStatus(status: string, dueDate: string, today: string): EntryDisplayStatus {
  if (status === 'aberto' && dueDate < today) return 'vencido'
  return status === 'pago' || status === 'cancelado' ? status : 'aberto'
}

/** Divide um valor em N parcelas iguais em centavos; a diferença vai na primeira. */
export function splitInstallments(total: number, n: number): number[] {
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / n)
  const parts = Array.from({ length: n }, () => base)
  parts[0] += cents - base * n
  return parts.map((c) => c / 100)
}

/** Soma meses mantendo o dia (31/01 + 1 mês = 28 ou 29/02). */
export function addMonthsISO(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

/** Vencimentos mensais a partir do primeiro. */
export function installmentDates(firstDue: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonthsISO(firstDue, i))
}

/** Primeiro e último dia do mês de uma data AAAA-MM-DD, e o mês anterior/seguinte (AAAA-MM). */
export function monthBounds(month: string): { start: string; end: string; prev: string; next: string } {
  const [y, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)
  return { start, end, prev, next }
}

export function isValidMonth(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export type CashFlowDay = { date: string; salesIn: number; received: number; paid: number; net: number; balance: number }

/**
 * Fluxo de caixa realizado, dia a dia: vendas à vista (tudo menos fiado, que
 * entra quando é recebido) + contas recebidas − contas pagas. `balance` é o
 * acumulado no período. Só aparecem dias com movimento.
 */
export function buildCashFlow(
  sales: { date: string; total: number }[],
  received: { date: string; amount: number }[],
  paid: { date: string; amount: number }[],
): { days: CashFlowDay[]; totals: { salesIn: number; received: number; paid: number; net: number } } {
  const map = new Map<string, { salesIn: number; received: number; paid: number }>()
  const day = (d: string) => {
    let v = map.get(d)
    if (!v) map.set(d, (v = { salesIn: 0, received: 0, paid: 0 }))
    return v
  }
  for (const s of sales) day(s.date).salesIn += Math.round(s.total * 100)
  for (const r of received) day(r.date).received += Math.round(r.amount * 100)
  for (const p of paid) day(p.date).paid += Math.round(p.amount * 100)

  let balance = 0
  const totals = { salesIn: 0, received: 0, paid: 0, net: 0 }
  const days = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => {
      const net = v.salesIn + v.received - v.paid
      balance += net
      totals.salesIn += v.salesIn
      totals.received += v.received
      totals.paid += v.paid
      totals.net += net
      return { date, salesIn: v.salesIn / 100, received: v.received / 100, paid: v.paid / 100, net: net / 100, balance: balance / 100 }
    })
  return {
    days,
    totals: { salesIn: totals.salesIn / 100, received: totals.received / 100, paid: totals.paid / 100, net: totals.net / 100 },
  }
}
