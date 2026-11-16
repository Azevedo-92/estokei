'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatQuantity, parseDecimalBR } from '@/lib/stock'
import { PAYMENT_METHODS } from '@/lib/pos'
import type { FormState } from '@/components/form-field'

/** Mensagens que as funções do banco escrevem para o usuário. */
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
  'Orçamento',
  'Este orçamento',
  'Só orçamentos',
  'Validade inválida',
  'Forma de pagamento',
]

function friendly(message: string | undefined, fallback: string): string {
  const msg = message ?? ''
  return KNOWN_ERRORS.some((k) => msg.startsWith(k))
    ? msg.replace(/\d+\.\d{3}\b/g, (n) => formatQuantity(Number(n)))
    : fallback
}

const quoteSchema = z.object({
  quoteId: z.string().uuid().nullable(),
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.number().positive().max(99_999_999_999) }))
    .min(1, 'Adicione pelo menos um produto.')
    .max(200, 'Orçamento com itens demais (máximo 200).'),
  customerId: z.string().uuid().nullable(),
  customerName: z.string().trim().max(200),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a validade.'),
  discount: z.number().min(0).max(9_999_999_999.99),
  notes: z.string().trim().max(1000),
})

export type SaveQuoteInput = z.input<typeof quoteSchema>
export type SaveQuoteResult = { ok: true; id: string } | { ok: false; message: string }

// Toda a equipe faz orçamento. Preço e validação ficam na função save_quote.
export async function saveQuoteAction(input: SaveQuoteInput): Promise<SaveQuoteResult> {
  const { organization } = await requireOrganization()
  const parsed = quoteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Confira os dados do orçamento.' }
  }
  const d = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_quote', {
    p_organization_id: organization.id,
    p_quote_id: d.quoteId,
    p_items: d.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_valid_until: d.validUntil,
    ...(d.customerId ? { p_customer_id: d.customerId } : {}),
    ...(!d.customerId && d.customerName ? { p_customer_name: d.customerName } : {}),
    p_discount: d.discount,
    ...(d.notes ? { p_notes: d.notes } : {}),
  })
  if (error || !data) {
    return { ok: false, message: friendly(error?.message, 'Não foi possível salvar o orçamento. Tente de novo.') }
  }
  revalidatePath('/orcamentos')
  revalidatePath(`/orcamentos/${data.id}`)
  return { ok: true, id: data.id }
}

export async function cancelQuoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOrganization()
  const id = z.string().uuid().safeParse(formData.get('quote_id'))
  if (!id.success) return { ok: false, message: 'Orçamento não encontrado.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_quote', { p_quote_id: id.data })
  if (error) return { ok: false, message: friendly(error.message, 'Não foi possível cancelar. Tente de novo.') }
  revalidatePath('/orcamentos')
  revalidatePath(`/orcamentos/${id.data}`)
  return { ok: true, message: 'Orçamento cancelado.' }
}

const convertSchema = z.object({
  quote_id: z.string().uuid(),
  payment_method: z.enum(PAYMENT_METHODS, { message: 'Escolha a forma de pagamento.' }),
  amount_received: z.number().min(0).max(9_999_999_999.99).nullable(),
})

// Converte em venda: preços e desconto do orçamento, baixa de estoque no banco.
export async function convertQuoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOrganization()
  const rawReceived = ((formData.get('amount_received') as string) ?? '').trim()
  const parsed = convertSchema.safeParse({
    quote_id: formData.get('quote_id'),
    payment_method: formData.get('payment_method'),
    amount_received: rawReceived === '' ? null : (parseDecimalBR(rawReceived) ?? Number.NaN),
  })
  if (!parsed.success) {
    return { ok: false, message: 'Corrija os campos destacados.', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const d = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('convert_quote', {
    p_quote_id: d.quote_id,
    p_payment_method: d.payment_method,
    ...(d.payment_method === 'dinheiro' && d.amount_received !== null ? { p_amount_received: d.amount_received } : {}),
  })
  if (error || !data) {
    return { ok: false, message: friendly(error?.message, 'Não foi possível converter em venda. Tente de novo.') }
  }
  revalidatePath('/orcamentos')
  revalidatePath('/vendas')
  revalidatePath('/produtos')
  revalidatePath('/estoque')
  revalidatePath('/painel')
  redirect(`/vendas/${data.id}`)
}
