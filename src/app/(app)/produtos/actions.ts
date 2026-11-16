'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { MANUAL_MOVEMENT_KINDS, onlyDigits, parseDecimalBR } from '@/lib/stock'
import type { FormState } from '@/components/form-field'

const NOT_ALLOWED: FormState = {
  ok: false,
  message: 'Só o dono e os administradores cadastram produtos e mexem no estoque.',
}

const money = (label: string) =>
  z
    .number({ message: `${label}: informe um valor.` })
    .min(0, `${label} não pode ser negativo.`)
    .max(9_999_999_999.99, `${label} muito alto.`)

const productSchema = z.object({
  code: z.string().trim().max(40, 'Código com no máximo 40 caracteres.'),
  name: z.string().trim().min(1, 'Nome é obrigatório.').max(200),
  barcode: z.string().refine((v) => v === '' || /^[0-9]{8,14}$/.test(v), 'Código de barras: 8 a 14 números.'),
  unit: z.string().trim().min(1, 'Informe a unidade.').max(10).transform((v) => v.toUpperCase()),
  cost_price: money('Preço de custo'),
  sale_price: money('Preço de venda'),
  min_stock: z.number().min(0, 'Estoque mínimo não pode ser negativo.').max(99_999_999_999),
  supplier_id: z.union([z.literal(''), z.string().uuid()]),
  active: z.enum(['true', 'false']),
  initial_stock: z.number().min(0, 'Estoque inicial não pode ser negativo.').max(99_999_999_999),
})

/** Campo numérico em pt-BR; vazio vira 0 (ou NaN para acusar erro de digitação). */
function num(formData: FormData, name: string): number {
  const raw = (formData.get(name) as string) ?? ''
  if (raw.trim() === '') return 0
  return parseDecimalBR(raw) ?? Number.NaN
}

export async function saveProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) return NOT_ALLOWED

  const parsed = productSchema.safeParse({
    code: (formData.get('code') as string) ?? '',
    name: (formData.get('name') as string) ?? '',
    barcode: onlyDigits(formData.get('barcode') as string),
    unit: (formData.get('unit') as string) || 'UN',
    cost_price: num(formData, 'cost_price'),
    sale_price: num(formData, 'sale_price'),
    min_stock: num(formData, 'min_stock'),
    supplier_id: (formData.get('supplier_id') as string) ?? '',
    // O formulário manda um 'false' escondido + 'true' quando a caixa está marcada.
    active: formData.getAll('active').includes('true') ? 'true' : 'false',
    initial_stock: num(formData, 'initial_stock'),
  })
  if (!parsed.success) {
    return { ok: false, message: 'Corrija os campos destacados.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const d = parsed.data
  const row = {
    name: d.name,
    barcode: d.barcode || null,
    unit: d.unit,
    cost_price: d.cost_price,
    sale_price: d.sale_price,
    min_stock: d.min_stock,
    supplier_id: d.supplier_id || null,
    active: d.active === 'true',
  }

  const id = (formData.get('id') as string) || null
  const supabase = await createClient()

  if (id) {
    const { error } = await supabase
      .from('products')
      .update({ ...row, ...(d.code ? { code: d.code } : {}) })
      .eq('id', id)
      .eq('organization_id', organization.id)
    if (error) return saveError(error.code)
    revalidatePath('/produtos')
    revalidatePath(`/produtos/${id}`)
    redirect(`/produtos/${id}?salvo=1`)
  }

  // Código vazio: o banco gera o próximo (P00001, P00002…).
  const { data: created, error } = await supabase
    .from('products')
    .insert({ organization_id: organization.id, code: d.code, ...row })
    .select('id')
    .single()
  if (error || !created) return saveError(error?.code)

  // O saldo só muda pela função do banco; o estoque inicial entra como uma entrada.
  if (d.initial_stock > 0) {
    const { error: stockError } = await supabase.rpc('record_stock_movement', {
      p_product_id: created.id,
      p_kind: 'entrada',
      p_quantity: d.initial_stock,
      p_notes: 'Estoque inicial',
    })
    if (stockError) {
      revalidatePath('/produtos')
      redirect(`/produtos/${created.id}?aviso=estoque-inicial`)
    }
  }

  revalidatePath('/produtos')
  redirect(`/produtos/${created.id}?salvo=1`)
}

function saveError(code: string | undefined): FormState {
  if (code === '23505') {
    return {
      ok: false,
      message: 'Já existe um produto com esse código ou código de barras.',
      fieldErrors: { code: ['Código ou código de barras já usado.'], barcode: ['Código ou código de barras já usado.'] },
    }
  }
  return { ok: false, message: 'Não foi possível salvar o produto. Tente de novo.' }
}

// ---- Movimentação de estoque ---------------------------------------------------

const movementSchema = z.object({
  product_id: z.string().uuid(),
  kind: z.enum(MANUAL_MOVEMENT_KINDS),
  quantity: z.number({ message: 'Informe a quantidade.' }).min(0, 'Quantidade inválida.').max(99_999_999_999),
  unit_cost: z.number().min(0).max(9_999_999_999.99).nullable(),
  supplier_id: z.union([z.literal(''), z.string().uuid()]),
  reference: z.string().trim().max(100),
  notes: z.string().trim().max(500),
})

export async function recordMovementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { role } = await requireOrganization()
  if (!canManageTeam(role)) return NOT_ALLOWED

  const rawCost = ((formData.get('unit_cost') as string) ?? '').trim()
  const parsed = movementSchema.safeParse({
    product_id: (formData.get('product_id') as string) ?? '',
    kind: (formData.get('kind') as string) ?? '',
    quantity: parseDecimalBR(formData.get('quantity') as string) ?? Number.NaN,
    unit_cost: rawCost === '' ? null : (parseDecimalBR(rawCost) ?? Number.NaN),
    supplier_id: (formData.get('supplier_id') as string) ?? '',
    reference: (formData.get('reference') as string) ?? '',
    notes: (formData.get('notes') as string) ?? '',
  })
  if (!parsed.success) {
    return { ok: false, message: 'Corrija os campos destacados.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const d = parsed.data
  const supabase = await createClient()
  // Toda a regra (permissão, saldo negativo, trava contra operações simultâneas)
  // está na função do banco; aqui só repassamos a mensagem dela.
  const { error } = await supabase.rpc('record_stock_movement', {
    p_product_id: d.product_id,
    p_kind: d.kind,
    p_quantity: d.quantity,
    ...(d.kind === 'entrada' && d.unit_cost !== null ? { p_unit_cost: d.unit_cost } : {}),
    ...(d.kind === 'entrada' && d.supplier_id ? { p_supplier_id: d.supplier_id } : {}),
    ...(d.reference ? { p_reference: d.reference } : {}),
    ...(d.notes ? { p_notes: d.notes } : {}),
  })
  if (error) {
    return { ok: false, message: friendlyStockError(error.message) }
  }

  revalidatePath('/produtos')
  revalidatePath(`/produtos/${d.product_id}`)
  revalidatePath('/estoque')
  return { ok: true, message: 'Estoque atualizado.' }
}

/** Mensagens que a própria função do banco escreve para o usuário. */
function friendlyStockError(message: string): string {
  const known = ['Estoque insuficiente', 'O estoque já está', 'Informe uma quantidade', 'Produto não encontrado']
  return known.some((k) => message.startsWith(k))
    ? message.replace(/(\d+)\.000\b/g, '$1')
    : 'Não foi possível registrar a movimentação. Tente de novo.'
}
