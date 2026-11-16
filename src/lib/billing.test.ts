import { describe, expect, it } from 'vitest'
import {
  billingState,
  formatDocument,
  isValidCnpj,
  isValidCpf,
  isValidDocument,
  shouldSuspendForNonPayment,
  type PaymentRow,
} from './billing'
import { PLANS, getPlan, planPrice, preselectedPlan, seatLimitMessage } from './plans'

const pay = (over: Partial<PaymentRow>): PaymentRow => ({
  id: 'pay_1',
  status: 'PENDING',
  value: 197,
  due_date: '2026-11-01',
  paid_at: null,
  invoice_url: 'https://asaas/i/1',
  deleted: false,
  ...over,
})

describe('planos', () => {
  it('anual cobra 10 mensalidades', () => {
    const p = getPlan('profissional')!
    expect(planPrice(p, 'monthly')).toBe(149)
    expect(planPrice(p, 'yearly')).toBe(1490)
  })

  it('plano pré-marcado: URL, depois o escolhido no cadastro, depois o padrão', () => {
    expect(preselectedPlan({ plano: 'essencial', ciclo: 'mensal' }, {})).toEqual({ plan: 'essencial', cycle: 'monthly' })
    expect(preselectedPlan({}, { desired_plan: 'completo', desired_cycle: 'monthly' })).toEqual({
      plan: 'completo',
      cycle: 'monthly',
    })
    expect(preselectedPlan({ plano: 'inventado' }, undefined)).toEqual({ plan: 'profissional', cycle: 'yearly' })
  })

  it('limites de pessoas', () => {
    expect(PLANS.map((p) => p.users)).toEqual([2, 5, 15])
    const essencial = getPlan('essencial')!
    expect(seatLimitMessage(essencial, 1)).toBeNull()
    expect(seatLimitMessage(essencial, 2)).toContain('até 2 pessoas')
  })
})

describe('billingState', () => {
  const sub = { canceled_at: null }

  it('sem assinatura e cancelada', () => {
    expect(billingState(null, [], '2026-11-01').kind).toBe('none')
    expect(billingState({ canceled_at: '2026-11-01T00:00:00Z' }, [], '2026-11-01').kind).toBe('canceled')
  })

  it('aguardando o primeiro pagamento', () => {
    const s = billingState(sub, [pay({})], '2026-11-01')
    expect(s).toMatchObject({ kind: 'awaiting_payment', payment: { id: 'pay_1' } })
  })

  it('em dia, com a próxima cobrança em aberto', () => {
    const s = billingState(
      sub,
      [
        pay({ id: 'pay_1', status: 'RECEIVED', due_date: '2026-10-01' }),
        pay({ id: 'pay_2', status: 'PENDING', due_date: '2026-11-01' }),
      ],
      '2026-10-20'
    )
    expect(s).toMatchObject({ kind: 'active', nextPayment: { id: 'pay_2' } })
  })

  it('cartão confirmado conta como pago', () => {
    expect(billingState(sub, [pay({ status: 'CONFIRMED' })], '2026-11-01').kind).toBe('active')
  })

  it('atrasada: conta os dias e a data de suspensão', () => {
    const s = billingState(
      sub,
      [
        pay({ id: 'pay_1', status: 'RECEIVED', due_date: '2026-10-01' }),
        pay({ id: 'pay_2', status: 'OVERDUE', due_date: '2026-11-01' }),
      ],
      '2026-11-08'
    )
    expect(s).toMatchObject({ kind: 'overdue', daysOverdue: 7, suspendOn: '2026-11-11' })
    expect(shouldSuspendForNonPayment(s)).toBe(false)
  })

  it('suspende com 10 dias de atraso', () => {
    const s = billingState(sub, [pay({ status: 'OVERDUE', due_date: '2026-11-01' })], '2026-11-11')
    expect(shouldSuspendForNonPayment(s)).toBe(true)
  })

  it('cobrança apagada não conta', () => {
    const s = billingState(
      sub,
      [
        pay({ id: 'pay_1', status: 'RECEIVED', due_date: '2026-10-01' }),
        pay({ id: 'pay_2', status: 'OVERDUE', due_date: '2026-11-01', deleted: true }),
      ],
      '2026-11-20'
    )
    expect(s.kind).toBe('active')
  })
})

describe('CPF e CNPJ', () => {
  it('CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
  })

  it('CNPJ numérico e alfanumérico', () => {
    expect(isValidCnpj('69.708.864/0001-69')).toBe(true)
    expect(isValidCnpj('69.708.864/0001-68')).toBe(false)
    // Exemplo publicado pela Receita Federal para o CNPJ alfanumérico.
    expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true)
    expect(isValidCnpj('12.ABC.345/01DE-36')).toBe(false)
  })

  it('documento e formatação', () => {
    expect(isValidDocument('52998224725')).toBe(true)
    expect(isValidDocument('123')).toBe(false)
    expect(formatDocument('69708864000169')).toBe('69.708.864/0001-69')
    expect(formatDocument('52998224725')).toBe('529.982.247-25')
  })
})
