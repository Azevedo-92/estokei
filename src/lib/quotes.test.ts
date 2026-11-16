import { describe, expect, it } from 'vitest'
import { addDaysISO, quoteDisplayStatus, quoteWhatsappText, whatsappNumber } from './quotes'

describe('quoteDisplayStatus', () => {
  it('aberto fora da validade aparece como vencido', () => {
    expect(quoteDisplayStatus('aberto', '2026-11-15', '2026-11-16')).toBe('vencido')
    expect(quoteDisplayStatus('aberto', '2026-11-16', '2026-11-16')).toBe('aberto')
    expect(quoteDisplayStatus('convertido', '2026-01-01', '2026-11-16')).toBe('convertido')
    expect(quoteDisplayStatus('cancelado', '2026-01-01', '2026-11-16')).toBe('cancelado')
  })
})

describe('addDaysISO', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(addDaysISO('2026-11-28', 7)).toBe('2026-12-05')
    expect(addDaysISO('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('whatsappNumber', () => {
  it('põe DDI 55 e recusa número curto', () => {
    expect(whatsappNumber('(11) 99999-8888')).toBe('5511999998888')
    expect(whatsappNumber('5511999998888')).toBe('5511999998888')
    expect(whatsappNumber('1133334444')).toBe('551133334444')
    expect(whatsappNumber('123')).toBeNull()
    expect(whatsappNumber(null)).toBeNull()
  })
})

describe('quoteWhatsappText', () => {
  it('monta o resumo do orçamento', () => {
    const text = quoteWhatsappText({
      number: 3,
      storeName: 'Loja X',
      customerName: 'João',
      validUntilBR: '23/11/2026',
      items: [{ name: 'Cimento', quantity: 2, unit: 'SC', total: 79.8 }],
      discount: 5,
      total: 74.8,
    })
    expect(text).toContain('*Orçamento #3 — Loja X*')
    expect(text).toContain('Cliente: João')
    expect(text).toContain('• 2 SC Cimento — R$ 79,80')
    expect(text).toContain('Desconto: R$ 5,00')
    expect(text).toContain('*Total: R$ 74,80*')
    expect(text).toContain('Válido até 23/11/2026.')
  })
})
