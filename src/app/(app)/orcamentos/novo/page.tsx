import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/utils'
import { DEFAULT_VALIDITY_DAYS, addDaysISO } from '@/lib/quotes'
import { QuoteEditor } from '../quote-editor'

export const metadata = { title: 'Novo orçamento' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function NovoOrcamentoPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { organization } = await requireOrganization()
  const { cliente } = await searchParams
  const today = todayISO()

  let customer = null
  if (cliente && UUID.test(cliente)) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('customers')
      .select('id, name, document, phone')
      .eq('id', cliente)
      .eq('organization_id', organization.id)
      .maybeSingle()
    customer = data
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Novo orçamento</h1>
      <QuoteEditor
        minDate={today}
        maxDate={addDaysISO(today, 365)}
        initial={{
          id: null,
          lines: [],
          customer,
          customerName: '',
          validUntil: addDaysISO(today, DEFAULT_VALIDITY_DAYS),
          discount: 0,
          notes: '',
        }}
      />
    </div>
  )
}
