import { notFound } from 'next/navigation'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { SupplierForm } from '../supplier-form'

export const metadata = { title: 'Editar fornecedor' }

export default async function EditarFornecedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) notFound()
  const { id } = await params

  const supabase = await createClient()
  const { data: s } = await supabase
    .from('suppliers')
    .select('id, name, document, contact_name, phone, email, notes, active')
    .eq('id', id)
    .eq('organization_id', organization.id)
    .maybeSingle()
  if (!s) notFound()

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">{s.name}</h1>
      <SupplierForm
        initial={{
          id: s.id,
          name: s.name,
          document: s.document ?? '',
          contact_name: s.contact_name ?? '',
          phone: s.phone ?? '',
          email: s.email ?? '',
          notes: s.notes ?? '',
          active: s.active,
        }}
      />
    </div>
  )
}
