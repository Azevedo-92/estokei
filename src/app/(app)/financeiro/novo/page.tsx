import { notFound } from 'next/navigation'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { todayISO } from '@/lib/utils'
import { NewEntryForm } from '../entry-forms'
import { loadParties } from '../parties'

export const metadata = { title: 'Nova conta' }

export default async function NovaContaPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) notFound()
  const kind = (await searchParams).tipo === 'pagar' ? 'pagar' : 'receber'
  const parties = await loadParties(await createClient(), organization.id, kind)

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Nova conta {kind === 'receber' ? 'a receber' : 'a pagar'}</h1>
      <NewEntryForm kind={kind} parties={parties} today={todayISO()} />
    </div>
  )
}
