import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Todo o produto opera no horário de Brasília — servidor (Vercel, em UTC) e
// navegador precisam mostrar a mesma data.
export const TIMEZONE = 'America/Sao_Paulo'

export function formatDateBR(date: string | Date | null | undefined) {
  if (!date) return ''
  // "2027-08-09" (coluna date do Postgres) é uma data de calendário, sem hora.
  // new Date() a leria como meia-noite UTC, que no Brasil é o dia anterior.
  if (typeof date === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    if (m) return `${m[3]}/${m[2]}/${m[1]}`
  }
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(d)
}

/** Dia (AAAA-MM-DD) em que um instante caiu, no horário de Brasília. */
export function dateInSaoPaulo(instant: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof instant === 'string' ? new Date(instant) : instant)
}

/** Data de hoje (ou daqui a N dias) como AAAA-MM-DD, no horário de Brasília. */
export function todayISO(offsetDays = 0): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() + offsetDays * 86_400_000))
}

export function formatCurrencyBRL(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return ''
  const n = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n)
}

/** "agora", "há 5 min", "há 3 dias"… */
export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, Date.now() - then)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `há ${hr} h`
  const days = Math.floor(hr / 24)
  if (days < 30) return `há ${days} dia${days === 1 ? '' : 's'}`
  const months = Math.floor(days / 30)
  return `há ${months} mês${months === 1 ? '' : 'es'}`
}
