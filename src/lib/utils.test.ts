import { afterEach, describe, expect, it, vi } from 'vitest'
import { dateInSaoPaulo, formatCurrencyBRL, formatDateBR, todayISO } from './utils'

afterEach(() => vi.useRealTimers())

describe('formatDateBR', () => {
  it('mostra data de calendário sem voltar um dia (bug do fuso)', () => {
    expect(formatDateBR('2027-08-09')).toBe('09/08/2027')
    expect(formatDateBR('2026-01-01')).toBe('01/01/2026')
  })

  it('formata horários no fuso de Brasília', () => {
    // 01:30 UTC do dia 24 ainda é dia 23 em Brasília
    expect(formatDateBR('2026-09-24T01:30:00Z')).toBe('23/09/2026')
  })

  it('devolve vazio sem data', () => {
    expect(formatDateBR(null)).toBe('')
    expect(formatDateBR(undefined)).toBe('')
    expect(formatDateBR('')).toBe('')
  })
})

describe('todayISO / dateInSaoPaulo', () => {
  it('usa o dia de Brasília, não o UTC', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T01:30:00Z')) // 22:30 do dia 23 em Brasília
    expect(todayISO()).toBe('2026-09-23')
    expect(todayISO(1)).toBe('2026-09-24')
    expect(todayISO(-30)).toBe('2026-08-24')
  })

  it('converte um instante para o dia em Brasília', () => {
    expect(dateInSaoPaulo('2026-10-16T02:59:00Z')).toBe('2026-10-15')
    expect(dateInSaoPaulo('2026-10-16T03:00:00Z')).toBe('2026-10-16')
  })
})

describe('formatCurrencyBRL', () => {
  it('usa ponto de milhar e vírgula decimal', () => {
    // Intl usa espaço não separável depois de "R$"
    expect(formatCurrencyBRL(38553.14).replace(/\s/g, ' ')).toBe('R$ 38.553,14')
    expect(formatCurrencyBRL('5000').replace(/\s/g, ' ')).toBe('R$ 5.000,00')
    expect(formatCurrencyBRL(null)).toBe('')
  })
})
