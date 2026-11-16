import { notFound } from 'next/navigation'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { ProductForm } from '../product-form'

export const metadata = { title: 'Novo produto' }

export default async function NovoProdutoPage() {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) notFound()

  const supabase = await createClient()
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('organization_id', organization.id)
    .eq('active', true)
    .order('name')
    .limit(1000)

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Novo produto</h1>
      <ProductForm
        suppliers={suppliers ?? []}
        initial={{
          code: '',
          name: '',
          barcode: '',
          unit: 'UN',
          cost_price: '',
          sale_price: '',
          min_stock: '',
          supplier_id: '',
          active: true,
        }}
      />
    </div>
  )
}
