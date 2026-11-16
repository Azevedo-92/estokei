// Regras puras do PDV (sem acesso ao banco), usadas pela tela do caixa.
// O valor que vale é o que o banco calcula em finalize_sale; aqui a conta é a
// mesma (preço do cadastro × quantidade, arredondado por item) só para mostrar
// o total ao caixa antes de finalizar.

export const PAYMENT_METHODS = ['dinheiro', 'pix', 'debito', 'credito', 'fiado', 'outro'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
  fiado: 'Fiado',
  outro: 'Outro',
}

export function paymentLabel(method: string): string {
  return PAYMENT_LABEL[method as PaymentMethod] ?? method
}

export const SALE_STATUS_LABEL: Record<string, string> = {
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export type CartLine = { productId: string; unitPrice: number; quantity: number }

/** Centavos inteiros para não acumular erro de ponto flutuante. */
function cents(value: number): number {
  return Math.round(value * 100)
}

/** Total de um item: quantidade × preço, arredondado para centavos (como no banco). */
export function lineTotal(line: Pick<CartLine, 'unitPrice' | 'quantity'>): number {
  return cents(line.unitPrice * line.quantity) / 100
}

/** Soma os itens; o mesmo produto em duas linhas é somado antes de arredondar. */
export function cartSubtotal(lines: CartLine[]): number {
  const byProduct = new Map<string, CartLine>()
  for (const l of lines) {
    const prev = byProduct.get(l.productId)
    byProduct.set(l.productId, prev ? { ...prev, quantity: prev.quantity + l.quantity } : l)
  }
  let total = 0
  for (const l of byProduct.values()) total += cents(l.unitPrice * l.quantity)
  return total / 100
}

export type CartTotals = { subtotal: number; discount: number; total: number; change: number | null }

/**
 * Totais da venda. `received` só vale para dinheiro; `change` é null quando não
 * se aplica e negativo quando o valor recebido não cobre o total.
 */
export function cartTotals(
  lines: CartLine[],
  discount: number,
  method: PaymentMethod,
  received: number | null,
): CartTotals {
  const subtotal = cartSubtotal(lines)
  const d = Math.min(Math.max(cents(discount || 0), 0), cents(subtotal)) / 100
  const total = (cents(subtotal) - cents(d)) / 100
  const change =
    method === 'dinheiro' && received !== null ? (cents(received) - cents(total)) / 100 : null
  return { subtotal, discount: d, total, change }
}
