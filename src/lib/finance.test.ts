import { describe, expect, it } from 'vitest'
import {
  addMonthsISO,
  buildCashFlow,
  entryDisplayStatus,
  installmentDates,
  isValidMonth,
  monthBounds,
  splitInstallments,
} from './finance'

describe('splitInstallments', () => {
  it('divide em centavos e joga a sobra na primeira', () => {
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33])
    expect(splitInstallments(90, 3)).toEqual([30, 30, 30])
    expect(splitInstallments(0.05, 2)).toEqual([0.03, 0.02])
  })
  it('a soma das parcelas é o total', () => {
    const p = splitInstallments(1234.57, 7)
    expect(Math.round(p.reduce((a, b) => a + b, 0) * 100)).toBe(123457)
  })
})

describe('datas', () => {
  it('soma meses respeitando o fim do mês', () => {
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsISO('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonthsISO('2026-11-16', 2)).toBe('2027-01-16')
  })
  it('vencimentos mensais', () => {
    expect(installmentDates('2026-11-30', 3)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30'])
  })
  it('limites do mês e navegação', () => {
    expect(monthBounds('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28', prev: '2026-01', next: '2026-03' })
    expect(monthBounds('2026-12').next).toBe('2027-01')
    expect(monthBounds('2026-01').prev).toBe('2025-12')
  })
  it('valida o mês da URL', () => {
    expect(isValidMonth('2026-11')).toBe(true)
    expect(isValidMonth('2026-13')).toBe(false)
    expect(isValidMonth('x')).toBe(false)
    expect(isValidMonth(undefined)).toBe(false)
  })
})

describe('entryDisplayStatus', () => {
  it('conta aberta com vencimento passado aparece vencida', () => {
    expect(entryDisplayStatus('aberto', '2026-11-15', '2026-11-16')).toBe('vencido')
    expect(entryDisplayStatus('aberto', '2026-11-16', '2026-11-16')).toBe('aberto')
    expect(entryDisplayStatus('pago', '2026-01-01', '2026-11-16')).toBe('pago')
  })
})

describe('buildCashFlow', () => {
  it('agrupa por dia e acumula o saldo', () => {
    const { days, totals } = buildCashFlow(
      [
        { date: '2026-11-02', total: 100.1 },
        { date: '2026-11-02', total: 0.2 },
        { date: '2026-11-05', total: 50 },
      ],
      [{ date: '2026-11-03', amount: 25 }],
      [{ date: '2026-11-02', amount: 30 }, { date: '2026-11-05', amount: 200 }],
    )
    expect(days.map((d) => [d.date, d.net, d.balance])).toEqual([
      ['2026-11-02', 70.3, 70.3],
      ['2026-11-03', 25, 95.3],
      ['2026-11-05', -150, -54.7],
    ])
    expect(totals).toEqual({ salesIn: 150.3, received: 25, paid: 230, net: -54.7 })
  })
})
