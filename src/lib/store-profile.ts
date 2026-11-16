import type { createClient } from '@/lib/supabase/server'

export type StoreProfile = {
  document: string | null
  phone: string | null
  email: string | null
  address: string | null
}

/** Dados da loja (CNPJ, telefone, e-mail, endereço) usados no orçamento e no cupom. */
export async function loadStoreProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
): Promise<StoreProfile> {
  const { data } = await supabase
    .from('organizations')
    .select('store_document, store_phone, store_email, store_address')
    .eq('id', organizationId)
    .maybeSingle()
  return {
    document: data?.store_document ?? null,
    phone: data?.store_phone ?? null,
    email: data?.store_email ?? null,
    address: data?.store_address ?? null,
  }
}

/** CPF/CNPJ com pontuação: 12345678000199 → 12.345.678/0001-99. */
export function formatDocument(doc: string | null | undefined): string {
  if (!doc) return ''
  if (/^\d{11}$/.test(doc)) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (/^[0-9A-Z]{12}\d{2}$/.test(doc)) return doc.replace(/(.{2})(.{3})(.{3})(.{4})(.{2})/, '$1.$2.$3/$4-$5')
  return doc
}

/** Telefone BR: 11999998888 → (11) 99999-8888; 1133334444 → (11) 3333-4444. */
export function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return phone
}
