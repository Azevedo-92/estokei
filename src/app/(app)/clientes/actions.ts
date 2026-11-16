'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { onlyDigits } from '@/lib/stock'
import type { FormState } from '@/components/form-field'

const customerSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.').max(200),
  document: z
    .string()
    .refine((v) => v === '' || v.length === 11 || v.length === 14, 'CPF (11 dígitos) ou CNPJ (14 dígitos).'),
  phone: z.string().max(30),
  email: z.union([z.literal(''), z.string().trim().email('E-mail inválido.').max(200)]),
  address: z.string().trim().max(500),
  notes: z.string().trim().max(2000),
  active: z.enum(['true', 'false']),
})

// Toda a equipe cadastra clientes (o caixa cadastra no balcão); o RLS confere a empresa.
export async function saveCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization } = await requireOrganization()

  const parsed = customerSchema.safeParse({
    name: (formData.get('name') as string) ?? '',
    document: onlyDigits(formData.get('document') as string),
    phone: onlyDigits(formData.get('phone') as string),
    email: ((formData.get('email') as string) ?? '').trim(),
    address: (formData.get('address') as string) ?? '',
    notes: (formData.get('notes') as string) ?? '',
    // O formulário manda um 'false' escondido + 'true' quando a caixa está marcada.
    active: formData.getAll('active').includes('true') ? 'true' : 'false',
  })
  if (!parsed.success) {
    return { ok: false, message: 'Corrija os campos destacados.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const d = parsed.data
  const row = {
    name: d.name,
    document: d.document || null,
    phone: d.phone || null,
    email: d.email || null,
    address: d.address || null,
    notes: d.notes || null,
    active: d.active === 'true',
  }

  const id = (formData.get('id') as string) || null
  const supabase = await createClient()
  const { error } = id
    ? await supabase.from('customers').update(row).eq('id', id).eq('organization_id', organization.id)
    : await supabase.from('customers').insert({ organization_id: organization.id, ...row })

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        message: 'Já existe um cliente com esse CPF/CNPJ.',
        fieldErrors: { document: ['CPF/CNPJ já cadastrado.'] },
      }
    }
    return { ok: false, message: 'Não foi possível salvar o cliente. Tente de novo.' }
  }

  revalidatePath('/clientes')
  redirect(id ? `/clientes/${id}?salvo=1` : '/clientes')
}
