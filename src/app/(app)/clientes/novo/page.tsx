import { requireOrganization } from '@/lib/auth'
import { CustomerForm } from '../customer-form'

export const metadata = { title: 'Novo cliente' }

export default async function NovoClientePage() {
  await requireOrganization()
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Novo cliente</h1>
      <CustomerForm
        initial={{ name: '', document: '', phone: '', email: '', address: '', notes: '', active: true }}
      />
    </div>
  )
}
