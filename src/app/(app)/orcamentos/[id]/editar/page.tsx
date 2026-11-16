import { notFound, redirect } from 'next/navigation'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/utils'
import { DEFAULT_VALIDITY_DAYS, addDaysISO } from '@/lib/quotes'
import { QuoteEditor } from '../../quote-editor'
import { loadQuote } from '../../load-quote'

export const metadata = { title: 'Editar orçamento' }

export default async function EditarOrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { organization } = await requireOrganization()
  const { id } = await params
  const supabase = await createClient()
  const quote = await loadQuote(supabase, organization.id, id)
  if (!quote) notFound()
  if (quote.status !== 'aberto') redirect(`/orcamentos/${quote.id}`)

  // Produtos atuais (preço e estoque de hoje): ao salvar, o orçamento pega os preços atuais.
  const { data: products } = await supabase
    .from('products')
    .select('id, code, name, barcode, unit, sale_price, stock_quantity, active')
    .eq('organization_id', organization.id)
    .in('id', quote.items.map((i) => i.product_id))
  const byId = new Map((products ?? []).map((p) => [p.id, p]))
  const today = todayISO()
  const missing = quote.items.filter((i) => !byId.get(i.product_id)?.active)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Editar orçamento #{quote.number}</h1>
      {missing.length > 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Saíram do orçamento por estarem inativos: {missing.map((i) => i.product_name).join(', ')}.
        </p>
      ) : null}
      <QuoteEditor
        minDate={today}
        maxDate={addDaysISO(today, 365)}
        initial={{
          id: quote.id,
          lines: quote.items
            .filter((i) => byId.get(i.product_id)?.active)
            .map((i) => ({ product: byId.get(i.product_id)!, quantity: Number(i.quantity) })),
          customer: quote.customers
            ? { id: quote.customers.id, name: quote.customers.name, document: quote.customers.document, phone: quote.customers.phone }
            : null,
          customerName: quote.customer_name ?? '',
          // Orçamento vencido ganha nova validade ao ser editado.
          validUntil: quote.valid_until >= today ? quote.valid_until : addDaysISO(today, DEFAULT_VALIDITY_DAYS),
          discount: Number(quote.discount),
          notes: quote.notes ?? '',
        }}
      />
    </div>
  )
}
