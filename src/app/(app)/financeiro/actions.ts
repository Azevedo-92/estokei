'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { parseDecimalBR } from '@/lib/stock'
import { todayISO } from '@/lib/utils'
import { FINANCE_METHODS, installmentDates, splitInstallments } from '@/lib/finance'
import type { FormState } from '@/components/form-field'
import type { Database } from '@/lib/supabase/database.types'

type EntryUpdate = Database['public']['Tables']['financial_entries']['Update']

const NOT_ALLOWED: FormState = { ok: false, message: 'Só o dono e os administradores acessam o financeiro.' }
const DATE = /^\d{4}-\d{2}-\d{2}$/

function revalidateFinance(id?: string) {
  revalidatePath('/financeiro')
  revalidatePath('/financeiro/fluxo')
  revalidatePath('/painel')
  if (id) revalidatePath(`/financeiro/${id}`)
}

function money(formData: FormData, name: string): number {
  return parseDecimalBR(formData.get(name) as string) ?? Number.NaN
}

const entrySchema = z.object({
  kind: z.enum(['receber', 'pagar']),
  description: z.string().trim().min(1, 'Descreva a conta.').max(200),
  category: z.string().trim().max(60),
  party_id: z.union([z.literal(''), z.string().uuid()]),
  amount: z.number({ message: 'Informe o valor.' }).positive('O valor precisa ser maior que zero.').max(9_999_999_999.99),
  due_date: z.string().regex(DATE, 'Informe o vencimento.'),
  installments: z.number().int().min(1, 'Mínimo 1 parcela.').max(60, 'Máximo 60 parcelas.'),
  notes: z.string().trim().max(1000),
  paid_now: z.boolean(),
  payment_method: z.union([z.literal(''), z.enum(FINANCE_METHODS)]),
})

// Nova conta (ou N parcelas mensais). Só dono/admin (RLS confere também).
export async function createEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) return NOT_ALLOWED

  const parsed = entrySchema.safeParse({
    kind: formData.get('kind'),
    description: (formData.get('description') as string) ?? '',
    category: (formData.get('category') as string) ?? '',
    party_id: (formData.get('party_id') as string) ?? '',
    amount: money(formData, 'amount'),
    due_date: (formData.get('due_date') as string) ?? '',
    installments: Number((formData.get('installments') as string) || '1'),
    notes: (formData.get('notes') as string) ?? '',
    paid_now: formData.get('paid_now') === 'on',
    payment_method: (formData.get('payment_method') as string) ?? '',
  })
  if (!parsed.success) {
    return { ok: false, message: 'Corrija os campos destacados.', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const d = parsed.data
  if (d.paid_now && d.installments > 1) {
    return { ok: false, message: 'Conta já paga não pode ser parcelada.', fieldErrors: { installments: ['Use 1 parcela.'] } }
  }

  const amounts = splitInstallments(d.amount, d.installments)
  const dates = installmentDates(d.due_date, d.installments)
  const groupId = d.installments > 1 ? randomUUID() : null
  const today = todayISO()
  const rows = amounts.map((amount, i) => ({
    organization_id: organization.id,
    kind: d.kind,
    description: d.description,
    category: d.category || null,
    customer_id: d.kind === 'receber' && d.party_id ? d.party_id : null,
    supplier_id: d.kind === 'pagar' && d.party_id ? d.party_id : null,
    amount,
    due_date: dates[i],
    group_id: groupId,
    installment: groupId ? i + 1 : null,
    installments: groupId ? d.installments : null,
    notes: d.notes || null,
    ...(d.paid_now
      ? { status: 'pago', paid_at: today, paid_amount: amount, payment_method: d.payment_method || null }
      : {}),
  }))

  const supabase = await createClient()
  const { data, error } = await supabase.from('financial_entries').insert(rows).select('id')
  if (error || !data) return { ok: false, message: 'Não foi possível salvar a conta. Tente de novo.' }

  revalidateFinance()
  redirect(data.length === 1 ? `/financeiro/${data[0].id}` : `/financeiro?tipo=${d.kind}`)
}

const editSchema = entrySchema.pick({ description: true, category: true, party_id: true, amount: true, due_date: true, notes: true })

export async function updateEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) return NOT_ALLOWED
  const id = z.string().uuid().safeParse(formData.get('id'))
  if (!id.success) return { ok: false, message: 'Conta não encontrada.' }
  const parsed = editSchema.safeParse({
    description: (formData.get('description') as string) ?? '',
    category: (formData.get('category') as string) ?? '',
    party_id: (formData.get('party_id') as string) ?? '',
    amount: money(formData, 'amount'),
    due_date: (formData.get('due_date') as string) ?? '',
    notes: (formData.get('notes') as string) ?? '',
  })
  if (!parsed.success) {
    return { ok: false, message: 'Corrija os campos destacados.', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const d = parsed.data
  const kind = formData.get('kind') === 'pagar' ? 'pagar' : 'receber'
  const supabase = await createClient()
  const { error } = await supabase
    .from('financial_entries')
    .update({
      description: d.description,
      category: d.category || null,
      ...(kind === 'receber' ? { customer_id: d.party_id || null } : { supplier_id: d.party_id || null }),
      amount: d.amount,
      due_date: d.due_date,
      notes: d.notes || null,
    })
    .eq('id', id.data)
    .eq('organization_id', organization.id)
    .neq('status', 'cancelado')
  if (error) return { ok: false, message: 'Não foi possível salvar. Tente de novo.' }
  revalidateFinance(id.data)
  return { ok: true, message: 'Conta atualizada.' }
}

const paySchema = z.object({
  id: z.string().uuid(),
  paid_at: z.string().regex(DATE, 'Informe a data.'),
  paid_amount: z.number({ message: 'Informe o valor.' }).min(0).max(9_999_999_999.99),
  payment_method: z.enum(FINANCE_METHODS, { message: 'Escolha a forma de pagamento.' }),
})

/** Dar baixa: recebida (a receber) ou paga (a pagar). */
export async function payEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) return NOT_ALLOWED
  const parsed = paySchema.safeParse({
    id: formData.get('id'),
    paid_at: formData.get('paid_at'),
    paid_amount: money(formData, 'paid_amount'),
    payment_method: formData.get('payment_method'),
  })
  if (!parsed.success) {
    return { ok: false, message: 'Corrija os campos destacados.', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const d = parsed.data
  if (d.paid_at > todayISO()) return { ok: false, message: 'A data da baixa não pode ser no futuro.', fieldErrors: { paid_at: ['Data no futuro.'] } }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('financial_entries')
    .update({ status: 'pago', paid_at: d.paid_at, paid_amount: d.paid_amount, payment_method: d.payment_method })
    .eq('id', d.id)
    .eq('organization_id', organization.id)
    .eq('status', 'aberto')
    .select('id')
  if (error) return { ok: false, message: 'Não foi possível dar baixa. Tente de novo.' }
  if (!data || data.length === 0) return { ok: false, message: 'Esta conta não está mais em aberto.' }
  revalidateFinance(d.id)
  return { ok: true, message: 'Baixa registrada.' }
}

async function setStatus(formData: FormData, from: 'pago' | 'aberto', change: EntryUpdate, okMsg: string): Promise<FormState> {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) return NOT_ALLOWED
  const id = z.string().uuid().safeParse(formData.get('id'))
  if (!id.success) return { ok: false, message: 'Conta não encontrada.' }
  const supabase = await createClient()
  let q = supabase
    .from('financial_entries')
    .update(change)
    .eq('id', id.data)
    .eq('organization_id', organization.id)
    .eq('status', from)
  // Conta de venda fiado só se cancela cancelando a venda.
  if (change.status === 'cancelado') q = q.is('sale_id', null)
  const { data, error } = await q.select('id')
  if (error) return { ok: false, message: 'Não foi possível alterar. Tente de novo.' }
  if (!data || data.length === 0) return { ok: false, message: 'A situação da conta mudou. Atualize a página.' }
  revalidateFinance(id.data)
  return { ok: true, message: okMsg }
}

/** Desfaz a baixa (volta para em aberto). */
export async function reopenEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return setStatus(formData, 'pago', { status: 'aberto', paid_at: null, paid_amount: null, payment_method: null }, 'Baixa estornada.')
}

export async function cancelEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return setStatus(formData, 'aberto', { status: 'cancelado' }, 'Conta cancelada.')
}

/** Apagar de vez: só conta avulsa (não ligada a venda). */
export async function deleteEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) return NOT_ALLOWED
  const id = z.string().uuid().safeParse(formData.get('id'))
  if (!id.success) return { ok: false, message: 'Conta não encontrada.' }
  const kind = formData.get('kind') === 'pagar' ? 'pagar' : 'receber'
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('financial_entries')
    .delete()
    .eq('id', id.data)
    .eq('organization_id', organization.id)
    .is('sale_id', null)
    .select('id')
  if (error || !data || data.length === 0) return { ok: false, message: 'Não foi possível excluir esta conta.' }
  revalidateFinance()
  redirect(`/financeiro?tipo=${kind}`)
}
