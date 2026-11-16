'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ACTIVE_ORG_COOKIE, requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * Passa a usar outra empresa (para quem participa de mais de uma). Só aceita
 * empresas das quais o usuário é membro. Quem chama navega para /painel.
 */
export async function switchOrganizationAction(
  organizationId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireUser()
  if (!z.string().uuid().safeParse(organizationId).success) {
    return { ok: false, message: 'Empresa inválida.' }
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!data) return { ok: false, message: 'Você não faz parte desta empresa.' }

  ;(await cookies()).set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  revalidatePath('/', 'layout')
  return { ok: true }
}
