import * as Sentry from '@sentry/nextjs'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CreateMemberForm } from './create-member-form'
import { InviteForm } from './invite-form'
import { MembersTable, type MemberRow } from './members-table'
import { InvitesList, type PendingInvite } from './invites-list'

export const metadata = { title: 'Equipe' }

export default async function EquipePage() {
  const { organization, user, role } = await requireOrganization()
  const canManage = role === 'owner' || role === 'admin'
  const supabase = await createClient()

  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from('organization_members')
      .select('id, user_id, role, created_at, profiles(full_name, email)')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('invites')
      .select(
        'id, email, role, expires_at, token, invited_by, profiles!invites_invited_by_profile_fkey(full_name)'
      )
      .eq('organization_id', organization.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ])

  // Lista vazia por erro de consulta parecia "equipe sem membros" — agora avisa.
  if (membersRes.error) Sentry.captureException(membersRes.error)
  if (invitesRes.error) Sentry.captureException(invitesRes.error)
  const loadFailed = !!membersRes.error

  const members: MemberRow[] = (membersRes.data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      id: row.id,
      user_id: row.user_id,
      role: row.role as MemberRow['role'],
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      created_at: row.created_at,
      isCurrentUser: row.user_id === user.id,
    }
  })

  const invites: PendingInvite[] = (invitesRes.data ?? []).map((row) => {
    const invitedBy = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      expires_at: row.expires_at,
      token: row.token,
      invited_by_name: invitedBy?.full_name ?? null,
    }
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Membros da {organization.name} com acesso ao Estokei.
          </p>
        </div>
      </header>

      {canManage ? <CreateMemberForm /> : null}

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Membros ({members.length})</h2>
        {loadFailed ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            Não foi possível carregar a lista de membros agora. Recarregue a página; se continuar,
            fale com o suporte.
          </p>
        ) : (
          <MembersTable members={members} currentUserRole={role as MemberRow['role']} />
        )}
      </div>

      {canManage ? (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer px-6 py-4 text-sm font-medium">
            Convidar por link (opcional)
          </summary>
          <div className="border-t p-6 space-y-6">
            <InviteForm />
            {invites.length > 0 ? <InvitesList invites={invites} appUrl={appUrl} /> : null}
          </div>
        </details>
      ) : null}
    </div>
  )
}
