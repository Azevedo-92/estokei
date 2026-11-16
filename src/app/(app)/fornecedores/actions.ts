'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { onlyDigits } from '@/lib/stock'
import type { FormState } from '@/components/form-field'

const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.').max(200),
  document: z
    .string()
    .refine((v) => v === '' || v.length === 11 || v.length === 14, 'CPF (11 dígitos) ou CNPJ (14 dígitos).'),
  contact_name: z.string().trim().max(200),
  phone: z.string().max(30),
  email: z.union([z.literal(''), z.string().trim().email('E-mail inválido.').max(200)]),
  notes: z.string().trim().max(2000),
  active: z.enum(['true', 'false']),
})

function readSupplier(formData: FormData) {
  return supplierSchema.safeParse({
    name: (formData.get('name') as string) ?? '',
    document: onlyDigits(formData.get('document') as string),
    contact_name: (formData.get('contact_name') as string) ?? '',
    phone: onlyDigits(formData.get('phone') as string),
    email: ((formData.get('email') as string) ?? '').trim(),
    notes: (formData.get('notes') as string) ?? '',
    // O formulário manda um 'false' escondido + 'true' quando a caixa está marcada.
    active: formData.getAll('active').includes('true') ? 'true' : 'false',
  })
}

function toRow(data: z.infer<typeof supplierSchema>) {
  return {
    name: data.name,
    document: data.document || null,
    contact_name: data.contact_name || null,
    phone: data.phone || null,
    email: data.email || null,
    notes: data.notes || null,
    active: data.active === 'true',
  }
}

const NOT_ALLOWED: FormState = {
  ok: false,
  message: 'Só o dono e os administradores cadastram fornecedores.',
}

export async function saveSupplierAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) return NOT_ALLOWED

  const parsed = readSupplier(formData)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Corrija os campos destacados.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const id = (formData.get('id') as string) || null
  const supabase = await createClient()
  const { error } = id
    ? await supabase
        .from('suppliers')
        .update(toRow(parsed.data))
        .eq('id', id)
        .eq('organization_id', organization.id)
    : await supabase.from('suppliers').insert({ organization_id: organization.id, ...toRow(parsed.data) })

  if (error) {
    return { ok: false, message: 'Não foi possível salvar o fornecedor. Tente de novo.' }
  }

  revalidatePath('/fornecedores')
  redirect('/fornecedores')
}
