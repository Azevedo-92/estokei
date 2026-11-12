import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'

export type TeamMember = {
  userId: string
  name: string
  email: string | null
  role: 'owner' | 'admin' | 'member'
}

export function canManageTeam(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

/** Membros da organização, em ordem alfabética — para escolher responsável. */
export async function loadTeamMembers(organizationId: string): Promise<TeamMember[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id, role, profiles(full_name, email)')
    .eq('organization_id', organizationId)
  if (error) Sentry.captureException(error)

  return (data ?? [])
    .map((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
      return {
        userId: m.user_id,
        name: profile?.full_name || profile?.email || 'Sem nome',
        email: profile?.email ?? null,
        role: m.role as TeamMember['role'],
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
