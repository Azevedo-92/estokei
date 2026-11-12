import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/** Cookie com a empresa em uso, para quem participa de mais de uma. */
export const ACTIVE_ORG_COOKIE = 'ek_org'

export const requireUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')
  return user
})

/**
 * Empresas do usuário logado (mais recentes primeiro) e a escolhida para uso:
 * a do seletor (cookie ek_org) se for válida; senão a liberada mais recente —
 * assim quem acabou de aceitar um convite cai na empresa que convidou — e, se
 * nenhuma estiver liberada, a mais recente.
 */
export const loadMemberships = cache(async () => {
  const user = await requireUser()
  const supabase = await createClient()

  const { data } = await supabase
    .from('organization_members')
    .select(
      'organization_id, role, created_at, organizations(id, name, slug, logo_url, primary_color, created_at, status, status_reason)'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const memberships = (data ?? []).filter((m) => m.organizations)
  const chosenId = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value
  const current =
    memberships.find((m) => m.organization_id === chosenId) ??
    memberships.find((m) => m.organizations!.status === 'active') ??
    memberships[0] ??
    null

  return { user, memberships, current }
})

/**
 * Empresa em uso + papel do usuário nela. `organizations` lista todas, para o
 * seletor. Sem empresa → /onboard; empresa aguardando liberação ou suspensa →
 * /aguardando-liberacao.
 */
export const requireOrganization = cache(async () => {
  const { user, memberships, current } = await loadMemberships()
  if (!current) redirect('/onboard')
  if (current.organizations!.status !== 'active') redirect('/aguardando-liberacao')

  return {
    user,
    role: current.role,
    organization: current.organizations!,
    organizations: memberships
      .map((m) => ({ id: m.organization_id, name: m.organizations!.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  }
})
