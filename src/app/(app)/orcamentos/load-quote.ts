import type { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Orçamento com itens e cliente, sempre filtrado pela empresa (além do RLS). */
export async function loadQuote(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  id: string,
) {
  if (!UUID.test(id)) return null
  const { data: quote } = await supabase
    .from('quotes')
    .select(
      'id, number, status, valid_until, subtotal, discount, total, notes, sale_id, created_at, created_by, customer_name, customers(id, name, document, phone, email, address)',
    )
    .eq('id', id)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!quote) return null

  const [{ data: items }, { data: author }, { data: sale }] = await Promise.all([
    supabase
      .from('quote_items')
      .select('id, product_id, product_code, product_name, unit, quantity, unit_price, total, position')
      .eq('quote_id', quote.id)
      .eq('organization_id', organizationId)
      .order('position'),
    quote.created_by
      ? supabase.from('profiles').select('full_name, email').eq('user_id', quote.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
    quote.sale_id
      ? supabase.from('sales').select('id, number').eq('id', quote.sale_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    ...quote,
    items: items ?? [],
    authorName: author?.full_name || author?.email || null,
    sale: sale ?? null,
  }
}

export type LoadedQuote = NonNullable<Awaited<ReturnType<typeof loadQuote>>>
