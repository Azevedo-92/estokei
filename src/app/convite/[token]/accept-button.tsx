'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { switchOrganizationAction } from '@/app/(app)/org-actions'

export function AcceptButton({ token }: { token: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function accept() {
    setLoading(true)
    const supabase = createClient()
    const { data: organizationId, error } = await supabase.rpc('accept_invite', {
      invite_token: token,
    })

    if (error) {
      setLoading(false)
      toast.error('Não foi possível aceitar', { description: error.message })
      return
    }

    // Quem já tinha outra empresa passa a usar a que convidou.
    if (organizationId) await switchOrganizationAction(organizationId)
    setLoading(false)

    toast.success('Bem-vindo à equipe!')
    router.push('/painel')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={accept}
      disabled={loading}
      className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {loading ? 'Aceitando…' : 'Aceitar convite'}
    </button>
  )
}
