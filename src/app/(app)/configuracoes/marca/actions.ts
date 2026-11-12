'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireOrganization } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { isValidHexColor } from '@/lib/branding'

const schema = z.object({
  primary_color: z
    .string()
    .refine((v) => !v || isValidHexColor(v), 'Cor inválida')
    .optional()
    .or(z.literal('')),
  remove_logo: z.enum(['true', 'false']).optional(),
})

export type BrandingFormState = {
  ok: boolean
  message?: string
  fieldErrors?: Record<string, string[]>
}

async function requireAdminRole() {
  const ctx = await requireOrganization()
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    throw new Error('Ação restrita a owners e admins da organização.')
  }
  return ctx
}

const LOGO_BUCKET = 'org-logos'
const LOGO_MAX_BYTES = 1_048_576 // 1MB
const ACCEPTED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export async function updateBrandingAction(
  _prev: BrandingFormState,
  formData: FormData
): Promise<BrandingFormState> {
  const { organization } = await requireAdminRole()

  const parsed = schema.safeParse({
    primary_color: (formData.get('primary_color') as string) ?? '',
    remove_logo: (formData.get('remove_logo') as string) ?? 'false',
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Corrija os campos destacados.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  // Service role: RLS de organizations e storage.objects fazem o server action
  // não conseguir atualizar/gravar mesmo com dono autenticado. A autorização é
  // feita acima em requireAdminRole() e o alvo é sempre organization.id da
  // sessão validada.
  const svc = createServiceClient()
  const patch: { primary_color?: string | null; logo_url?: string | null } = {}

  if (parsed.data.primary_color) {
    patch.primary_color = parsed.data.primary_color
  }

  const file = formData.get('logo') as File | null
  const wantsRemoval = parsed.data.remove_logo === 'true'

  if (wantsRemoval) {
    const { data: existing } = await svc.storage.from(LOGO_BUCKET).list(organization.id)
    if (existing && existing.length > 0) {
      const paths = existing.map((e) => `${organization.id}/${e.name}`)
      await svc.storage.from(LOGO_BUCKET).remove(paths)
    }
    patch.logo_url = null
  } else if (file && typeof file !== 'string' && file.size > 0) {
    if (file.size > LOGO_MAX_BYTES) {
      return { ok: false, message: 'Logo excede o tamanho máximo de 1MB.' }
    }
    const ext = ACCEPTED_TYPES[file.type]
    if (!ext) {
      return {
        ok: false,
        message: 'Formato não suportado. Use PNG, JPG, WEBP ou SVG.',
      }
    }
    const path = `${organization.id}/logo.${ext}`

    const { data: existing } = await svc.storage.from(LOGO_BUCKET).list(organization.id)
    const toDelete = (existing ?? [])
      .filter((e) => e.name.startsWith('logo.') && e.name !== `logo.${ext}`)
      .map((e) => `${organization.id}/${e.name}`)
    if (toDelete.length > 0) {
      await svc.storage.from(LOGO_BUCKET).remove(toDelete)
    }

    const bytes = await file.arrayBuffer()
    const { error: uploadError } = await svc.storage
      .from(LOGO_BUCKET)
      .upload(path, bytes, {
        upsert: true,
        contentType: file.type,
      })

    if (uploadError) return { ok: false, message: uploadError.message }

    const { data: publicData } = svc.storage.from(LOGO_BUCKET).getPublicUrl(path)
    patch.logo_url = `${publicData.publicUrl}?v=${Date.now()}`
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, message: 'Nada foi alterado.' }
  }

  const { data: updated, error: updateError } = await svc
    .from('organizations')
    .update(patch)
    .eq('id', organization.id)
    .select('id')

  if (updateError) return { ok: false, message: updateError.message }
  if (!updated || updated.length === 0) {
    return { ok: false, message: 'Nada foi atualizado — verifique se você tem permissão.' }
  }

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Marca atualizada.' }
}
