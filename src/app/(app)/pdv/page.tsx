import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Pos } from './pos'

export const metadata = { title: 'PDV' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Toda a equipe vende (caixa, vendedor, dono). A venda em si é feita pela
// função finalize_sale no banco; esta tela só monta o carrinho.
export default async function PdvPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { organization } = await requireOrganization()
  const { cliente } = await searchParams

  let initialCustomer = null
  if (cliente && UUID.test(cliente)) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('customers')
      .select('id, name, document, phone')
      .eq('id', cliente)
      .eq('organization_id', organization.id)
      .eq('active', true)
      .maybeSingle()
    initialCustomer = data
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">PDV</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Venda no balcão. Ao finalizar, o estoque é baixado na hora.
        </p>
      </header>
      <Pos initialCustomer={initialCustomer} />
    </div>
  )
}
