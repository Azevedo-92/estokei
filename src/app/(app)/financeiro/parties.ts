import type { createClient } from '@/lib/supabase/server'
import type { EntryKind } from '@/lib/finance'

/** Clientes (a receber) ou fornecedores (a pagar) ativos para o seletor. */
export async function loadParties(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  kind: EntryKind,
  includeId?: string | null,
) {
  const table = kind === 'receber' ? 'customers' : 'suppliers'
  const { data } = await supabase
    .from(table)
    .select('id, name')
    .eq('organization_id', organizationId)
    .or(`active.eq.true${includeId ? `,id.eq.${includeId}` : ''}`)
    .order('name')
    .limit(1000)
  return data ?? []
}
