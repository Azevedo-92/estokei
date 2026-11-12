'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { requireOrganization } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPlan, seatLimitMessage } from '@/lib/plans'

type Role = 'owner' | 'admin' | 'member'

export type InviteState = {
  ok: boolean
  message?: string
  inviteUrl?: string
  fieldErrors?: Record<string, string[]>
}

export type MemberCreateState = {
  ok: boolean
  message?: string
  fieldErrors?: Record<string, string[]>
}

const inviteSchema = z.object({
  email: z.string().email('E-mail inválido').max(200).optional().or(z.literal('')),
  role: z.enum(['admin', 'member']),
})

const memberCreateSchema = z.object({
  full_name: z.string().min(1, 'Nome é obrigatório').max(200),
  email: z.string().email('E-mail inválido').max(200),
  password: z.string().min(8, 'Mínimo de 8 caracteres').max(200),
  role: z.enum(['admin', 'member']),
})

function generateToken(): string {
  return randomBytes(24).toString('base64url')
}

async function requireAdminRole() {
  const ctx = await requireOrganization()
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    throw new Error('Ação restrita a owners e admins da organização.')
  }
  return ctx
}

/**
 * Bloqueia nova pessoa quando a equipe (membros + convites pendentes) já ocupa
 * todas as vagas do plano. Empresa sem assinatura (contratada antes da cobrança
 * pelo sistema) não tem limite.
 */
async function seatLimitError(organizationId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, canceled_at')
    .eq('organization_id', organizationId)
    .maybeSingle()
  const plan = sub && !sub.canceled_at ? getPlan(sub.plan) : undefined
  if (!plan) return null

  const [{ count: members }, { count: invites }] = await Promise.all([
    supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('invites')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString()),
  ])
  return seatLimitMessage(plan, (members ?? 0) + (invites ?? 0))
}

export async function createMemberAction(
  _prev: MemberCreateState,
  formData: FormData
): Promise<MemberCreateState> {
  const { organization, user } = await requireAdminRole()

  const parsed = memberCreateSchema.safeParse({
    full_name: (formData.get('full_name') as string) ?? '',
    email: (formData.get('email') as string) ?? '',
    password: (formData.get('password') as string) ?? '',
    role: (formData.get('role') as string) ?? 'member',
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Corrija os campos destacados.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const limit = await seatLimitError(organization.id)
  if (limit) return { ok: false, message: limit }

  const admin = createServiceClient()
  const supabase = await createClient()

  // 1) A pessoa já tem conta? A busca usa o cliente de serviço porque o RLS de
  // profiles só mostra quem já é da mesma empresa — sem isso, quem tem conta
  // em outra empresa não era achado e o createUser abaixo falhava.
  const emailLower = parsed.data.email.trim().toLowerCase()
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('user_id')
    .ilike('email', emailLower)
    .limit(1)

  let userId: string
  const alreadyHadAccount = !!existingProfile && existingProfile.length > 0
  if (existingProfile && existingProfile.length > 0) {
    userId = existingProfile[0].user_id

    // Prevent adding twice to the same org
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('user_id', userId)
      .limit(1)
    if (existingMember && existingMember.length > 0) {
      return { ok: false, message: 'Este usuário já é membro da organização.' }
    }
  } else {
    // 2) Create the auth user via admin API.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: parsed.data.email.trim(),
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.full_name.trim() },
    })

    if (createError || !created.user) {
      return {
        ok: false,
        message: createError?.message ?? 'Não foi possível criar o usuário.',
      }
    }
    userId = created.user.id
  }

  // 3) Add to organization_members
  const { error: memberError } = await supabase.from('organization_members').insert({
    organization_id: organization.id,
    user_id: userId,
    role: parsed.data.role,
    invited_by: user.id,
  })

  if (memberError) {
    return { ok: false, message: memberError.message }
  }

  revalidatePath('/equipe')
  return {
    ok: true,
    message: alreadyHadAccount
      ? `${parsed.data.full_name.trim()} já tinha conta no Estokei e foi adicionado à equipe. Entra com a senha que já usa.`
      : `${parsed.data.full_name.trim()} cadastrado com acesso imediato.`,
  }
}

export async function createInviteAction(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
  const { organization, user } = await requireAdminRole()

  const parsed = inviteSchema.safeParse({
    email: (formData.get('email') as string) ?? '',
    role: (formData.get('role') as string) ?? 'member',
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Corrija os campos destacados.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const limit = await seatLimitError(organization.id)
  if (limit) return { ok: false, message: limit }

  const token = generateToken()
  const supabase = await createClient()
  const { error } = await supabase.from('invites').insert({
    organization_id: organization.id,
    email: parsed.data.email || null,
    role: parsed.data.role,
    invited_by: user.id,
    token,
  })

  if (error) return { ok: false, message: error.message }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const inviteUrl = `${appUrl}/convite/${token}`

  revalidatePath('/equipe')
  return {
    ok: true,
    message: 'Convite criado. Copie o link e envie ao convidado.',
    inviteUrl,
  }
}

export async function revokeInviteAction(inviteId: string) {
  const { organization } = await requireAdminRole()
  const supabase = await createClient()
  const { error } = await supabase
    .from('invites')
    .delete()
    .eq('id', inviteId)
    .eq('organization_id', organization.id)

  if (error) throw new Error(error.message)
  revalidatePath('/equipe')
}

export async function changeMemberRoleAction(memberId: string, newRole: Role) {
  const { organization } = await requireAdminRole()
  const supabase = await createClient()
  const { error } = await supabase
    .from('organization_members')
    .update({ role: newRole })
    .eq('id', memberId)
    .eq('organization_id', organization.id)

  if (error) throw new Error(error.message)
  revalidatePath('/equipe')
}

export async function removeMemberAction(memberId: string) {
  const { organization } = await requireAdminRole()
  const supabase = await createClient()
  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', organization.id)

  if (error) throw new Error(error.message)
  revalidatePath('/equipe')
}
