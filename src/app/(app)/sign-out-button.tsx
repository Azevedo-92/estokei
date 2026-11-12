'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()
  const [pending, start] = useTransition()

  function onClick() {
    start(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/entrar')
      router.refresh()
    })
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="mt-1 w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors disabled:opacity-50"
    >
      <LogOut className="h-3.5 w-3.5" />
      {pending ? 'Saindo…' : 'Sair'}
    </button>
  )
}
