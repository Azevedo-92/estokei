import { notFound } from 'next/navigation'
import { requireOrganization } from '@/lib/auth'
import { canManageTeam } from '@/lib/team'
import { SupplierForm } from '../supplier-form'

export const metadata = { title: 'Novo fornecedor' }

export default async function NovoFornecedorPage() {
  const { role } = await requireOrganization()
  if (!canManageTeam(role)) notFound()

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Novo fornecedor</h1>
      <SupplierForm
        initial={{ name: '', document: '', contact_name: '', phone: '', email: '', notes: '', active: true }}
      />
    </div>
  )
}
