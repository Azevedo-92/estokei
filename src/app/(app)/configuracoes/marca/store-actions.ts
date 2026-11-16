'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { onlyDigits } from '@/lib/stock'
import type { FormState } from '@/components/form-field'

const storeSchema = z.object({
  document: z
    .string()
    .refine((v) => v === '' || v.length === 11 || v.length === 14, 'CPF (11 dígitos) ou CNPJ (14 dígitos).'),
  phone: z.string().max(30),
  email: z.union([z.literal(''), z.string().trim().email('E-mail inválido.').max(200)]),
  address: z.string().trim().max(300, 'Endereço com no máximo 300 caracteres.'),
})

// Usuário não tem UPDATE em organizations: grava pela função do banco, que
// também confere se é dono/administrador.
export async function saveStoreProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) {
    return { ok: false, message: 'Só o dono e os administradores alteram os dados da loja.' }
  }
  const parsed = storeSchema.safeParse({
    document: onlyDigits(formData.get('document') as string),
    phone: onlyDigits(formData.get('phone') as string),
    email: ((formData.get('email') as string) ?? '').trim(),
    address: (formData.get('address') as string) ?? '',
  })
  if (!parsed.success) {
    return { ok: false, message: 'Corrija os campos destacados.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_store_profile', {
    p_organization_id: organization.id,
    p_document: parsed.data.document,
    p_phone: parsed.data.phone,
    p_email: parsed.data.email,
    p_address: parsed.data.address,
  })
  if (error) return { ok: false, message: 'Não foi possível salvar os dados da loja. Tente de novo.' }

  revalidatePath('/configuracoes/marca')
  return { ok: true, message: 'Dados da loja salvos.' }
}
