// Regras puras de produtos e estoque (sem acesso ao banco), usadas pelas telas
// e pelas actions. A regra de saldo em si mora no banco (record_stock_movement).

export const PAGE_SIZE = 50

export type MovementKind = 'entrada' | 'perda' | 'ajuste' | 'venda' | 'estorno'

/** Tipos que a equipe lança à mão (venda e estorno vêm do PDV). */
export const MANUAL_MOVEMENT_KINDS = ['entrada', 'perda', 'ajuste'] as const
export type ManualMovementKind = (typeof MANUAL_MOVEMENT_KINDS)[number]

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  entrada: 'Entrada',
  perda: 'Perda',
  ajuste: 'Ajuste (contagem)',
  venda: 'Venda',
  estorno: 'Estorno',
}

export const MOVEMENT_CHIP: Record<MovementKind, string> = {
  entrada: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  perda: 'bg-rose-100 text-rose-800 border-rose-200',
  ajuste: 'bg-sky-100 text-sky-800 border-sky-200',
  venda: 'bg-amber-100 text-amber-800 border-amber-200',
  estorno: 'bg-violet-100 text-violet-800 border-violet-200',
}

export function movementLabel(kind: string): string {
  return MOVEMENT_LABEL[kind as MovementKind] ?? kind
}

export function movementChip(kind: string): string {
  return MOVEMENT_CHIP[kind as MovementKind] ?? 'bg-muted text-muted-foreground border-border'
}

/** Unidades mais comuns no comércio; o campo aceita outras. */
export const COMMON_UNITS = ['UN', 'CX', 'PC', 'KG', 'G', 'M', 'M2', 'M3', 'L', 'SC', 'RL', 'PAR', 'KIT']

/**
 * Lê número digitado no padrão brasileiro: "1.234,56", "10,5", "10.5", "7".
 * Devolve null se vazio ou inválido.
 */
export function parseDecimalBR(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  let s = String(raw).trim().replace(/\s|R\$/g, '')
  if (!s) return null
  if (s.includes(',')) {
    // Vírgula é o separador decimal; pontos são de milhar.
    s = s.replace(/\./g, '').replace(',', '.')
  } else if ((s.match(/\./g) ?? []).length > 1) {
    // "1.234.567" sem vírgula: só milhares.
    s = s.replace(/\./g, '')
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Quantidade sem zeros inúteis: 10 → "10", 2.5 → "2,5", 0.125 → "0,125". */
export function formatQuantity(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const n = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(n)
}

/** Número para preencher campo de formulário: 39.9 → "39,90" (dinheiro) ou "2,5". */
export function toInputBR(value: number | string | null | undefined, decimals?: number): string {
  if (value === null || value === undefined || value === '') return ''
  const n = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 3,
    useGrouping: false,
  }).format(n)
}

/** Só dígitos (CNPJ/CPF, código de barras, telefone). */
export function onlyDigits(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '')
}

/**
 * Texto de busca seguro para o filtro `or(...)` do PostgREST: tira os
 * caracteres que mudariam o filtro (vírgula, parênteses, curingas) e limita o
 * tamanho. Sem isso, uma busca com "," montaria um filtro diferente.
 */
export function sanitizeSearch(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/[,()*%\\:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

/** Página atual a partir de ?pagina=, sempre >= 1. */
export function pageFromParam(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** Faixa (from/to inclusivos) para o .range() do Supabase. */
export function pageRange(page: number, size = PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * size
  return { from, to: from + size - 1 }
}
