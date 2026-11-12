'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Sai da conta atual e volta ao login já com o convite. */
export function SwitchAccountButton({ token }: { token: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await createClient().auth.signOut()
          router.push(`/entrar?convite=${encodeURIComponent(token)}`)
          router.refresh()
        })
      }
      className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {pending ? 'Saindo…' : 'Sair e entrar com a conta convidada'}
    </button>
  )
}
