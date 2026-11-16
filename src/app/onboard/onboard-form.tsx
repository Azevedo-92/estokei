'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { notifyNewOrganizationAction } from '../plataforma/actions'

function slugify(input: string) {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function OnboardForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const orgName = name.trim()
    if (!orgName) return

    const baseSlug = slugify(orgName) || 'empresa'
    // Ensure uniqueness by appending a short random suffix.
    const suffix = Math.random().toString(36).slice(2, 6)
    const slug = `${baseSlug}-${suffix}`

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('create_organization_and_join', {
      org_name: orgName,
      org_slug: slug,
    })
    setLoading(false)

    if (error) {
      toast.error('Não foi possível criar a empresa', { description: error.message })
      return
    }

    // Empresa nova aguarda liberação; o dono da plataforma é avisado por e-mail.
    await notifyNewOrganizationAction().catch(() => {})
    toast.success('Empresa criada!')
    router.push('/aguardando-liberacao')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Nome da empresa
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Chowder Academy"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Criando…' : 'Criar empresa'}
      </button>
    </form>
  )
}
