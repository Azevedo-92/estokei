'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatQuantity, onlyDigits, sanitizeSearch } from '@/lib/stock'
import { PAYMENT_METHODS } from '@/lib/pos'

export type PosProduct = {
  id: string
  code: string
  name: string
  barcode: string | null
  unit: string
  sale_price: number
  stock_quantity: number
}

export type PosCustomer = { id: string; name: string; document: string | null; phone: string | null }

/**
 * Busca para o caixa: código de barras exato (leitor), código exato ou parte do nome.
 * Só produtos ativos; no máximo 20.
 */
export async function searchProductsAction(term: string): Promise<PosProduct[]> {
  const { organization } = await requireOrganization()
  const q = sanitizeSearch(term)
  if (!q) return []

  const supabase = await createClient()
  const cols = 'id, code, name, barcode, unit, sale_price, stock_quantity'

  // Leitor de código de barras: só dígitos (8 a 14) → busca exata primeiro.
  const digits = onlyDigits(q)
  if (digits === q && digits.length >= 8 && digits.length <= 14) {
    const { data } = await supabase
      .from('products')
      .select(cols)
      .eq('organization_id', organization.id)
      .eq('active', true)
      .eq('barcode', digits)
      .limit(1)
    if (data && data.length > 0) return data
  }

  const { data } = await supabase
    .from('products')
    .select(cols)
    .eq('organization_id', organization.id)
    .eq('active', true)
    .or(`code.ilike.${q},name.ilike.%${q}%,code.ilike.%${q}%,barcode.ilike.%${q}%`)
    .order('name')
    .limit(20)
  const rows = data ?? []
  // Código digitado exato vem primeiro.
  const upper = q.toUpperCase()
  return rows.sort((a, b) => Number(b.code.toUpperCase() === upper) - Number(a.code.toUpperCase() === upper))
}

export async function searchCustomersAction(term: string): Promise<PosCustomer[]> {
  const { organization } = await requireOrganization()
  const q = sanitizeSearch(term)
  if (!q) return []
  const digits = q.replace(/\D/g, '')
  const filters = [`name.ilike.%${q}%`]
  if (digits) filters.push(`document.ilike.%${digits}%`, `phone.ilike.%${digits}%`)

  const supabase = await createClient()
  const { data } = await supabase
    .from('customers')
    .select('id, name, document, phone')
    .eq('organization_id', organization.id)
    .eq('active', true)
    .or(filters.join(','))
    .order('name')
    .limit(10)
  return data ?? []
}

const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive().max(99_999_999_999),
      }),
    )
    .min(1, 'Adicione pelo menos um produto.')
    .max(200, 'Venda com itens demais (máximo 200).'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  customerId: z.string().uuid().nullable(),
  discount: z.number().min(0).max(9_999_999_999.99),
  amountReceived: z.number().min(0).max(9_999_999_999.99).nullable(),
  notes: z.string().trim().max(500),
})

export type FinalizeSaleInput = z.input<typeof saleSchema>
export type FinalizeSaleResult =
  | { ok: true; saleId: string; number: number; total: number; change: number | null }
  | { ok: false; message: string }

/** Mensagens que a própria função do banco escreve para o usuário. */
const KNOWN_ERRORS = [
  'Estoque insuficiente',
  'O produto',
  'Produto não encontrado',
  'Cliente não encontrado',
  'Venda fiado',
  'Desconto inválido',
  'Valor recebido',
  'Informe uma quantidade',
  'Adicione pelo menos',
  'Venda com itens',
  'Forma de pagamento',
]

export async function finalizeSaleAction(input: FinalizeSaleInput): Promise<FinalizeSaleResult> {
  const { organization } = await requireOrganization()
  const parsed = saleSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Confira os dados da venda.' }
  }
  const d = parsed.data
  if (d.paymentMethod === 'fiado' && !d.customerId) {
    return { ok: false, message: 'Venda fiado precisa de um cliente.' }
  }

  const supabase = await createClient()
  // Preço, saldo, permissão e trava contra vendas simultâneas: tudo no banco.
  const { data, error } = await supabase.rpc('finalize_sale', {
    p_organization_id: organization.id,
    p_items: d.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_payment_method: d.paymentMethod,
    ...(d.customerId ? { p_customer_id: d.customerId } : {}),
    p_discount: d.discount,
    ...(d.paymentMethod === 'dinheiro' && d.amountReceived !== null ? { p_amount_received: d.amountReceived } : {}),
    ...(d.notes ? { p_notes: d.notes } : {}),
  })
  if (error || !data) {
    const msg = error?.message ?? ''
    return {
      ok: false,
      message: KNOWN_ERRORS.some((k) => msg.startsWith(k))
        ? msg.replace(/\d+\.\d{3}\b/g, (n) => formatQuantity(Number(n)))
        : 'Não foi possível finalizar a venda. Tente de novo.',
    }
  }

  revalidatePath('/vendas')
  revalidatePath('/produtos')
  revalidatePath('/estoque')
  revalidatePath('/painel')
  return {
    ok: true,
    saleId: data.id,
    number: data.number,
    total: Number(data.total),
    change: data.change_amount === null ? null : Number(data.change_amount),
  }
}
