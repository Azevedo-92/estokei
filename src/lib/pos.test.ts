import { describe, expect, it } from 'vitest'
import { cartSubtotal, cartTotals, lineTotal, paymentLabel } from './pos'

describe('lineTotal', () => {
  it('arredonda por item para centavos', () => {
    expect(lineTotal({ unitPrice: 39.9, quantity: 3 })).toBe(119.7)
    expect(lineTotal({ unitPrice: 12.5, quantity: 1.5 })).toBe(18.75)
    expect(lineTotal({ unitPrice: 0.1, quantity: 3 })).toBe(0.3)
  })
})

describe('cartSubtotal', () => {
  it('soma o mesmo produto antes de arredondar (igual ao banco)', () => {
    const lines = [
      { productId: 'a', unitPrice: 39.9, quantity: 2 },
      { productId: 'b', unitPrice: 12.5, quantity: 1.5 },
      { productId: 'a', unitPrice: 39.9, quantity: 1 },
    ]
    expect(cartSubtotal(lines)).toBe(138.45)
  })
  it('carrinho vazio é zero', () => {
    expect(cartSubtotal([])).toBe(0)
  })
})

describe('cartTotals', () => {
  const lines = [{ productId: 'a', unitPrice: 39.9, quantity: 2 }]
  it('aplica desconto e calcula troco no dinheiro', () => {
    expect(cartTotals(lines, 5, 'dinheiro', 100)).toEqual({ subtotal: 79.8, discount: 5, total: 74.8, change: 25.2 })
  })
  it('desconto não passa do subtotal nem fica negativo', () => {
    expect(cartTotals(lines, 500, 'pix', null).total).toBe(0)
    expect(cartTotals(lines, -3, 'pix', null).discount).toBe(0)
  })
  it('troco só no dinheiro; negativo quando falta', () => {
    expect(cartTotals(lines, 0, 'pix', 100).change).toBeNull()
    expect(cartTotals(lines, 0, 'dinheiro', 50).change).toBe(-29.8)
    expect(cartTotals(lines, 0, 'dinheiro', null).change).toBeNull()
  })
})

describe('paymentLabel', () => {
  it('traduz a forma de pagamento', () => {
    expect(paymentLabel('debito')).toBe('Cartão de débito')
    expect(paymentLabel('x')).toBe('x')
  })
})
