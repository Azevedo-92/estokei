'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

/** Pede o link de redefinição de senha por e-mail. */
export function RequestResetForm() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = (event.currentTarget.elements.namedItem('email') as HTMLInputElement).value.trim()

    // Depois de criar a senha, quem veio de um convite volta para ele.
    const convite = searchParams.get('convite')
    const after = convite
      ? `/redefinir-senha/nova?convite=${encodeURIComponent(convite)}`
      : '/redefinir-senha/nova'

    setLoading(true)
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(after)}`,
    })
    setLoading(false)

    if (error) {
      toast.error('Não foi possível enviar o link', { description: error.message })
      return
    }
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium">Confira seu e-mail</p>
        <p className="text-muted-foreground">
          Se existir uma conta com <strong className="text-foreground">{sentTo}</strong>, enviamos
          um link para criar uma senha nova. Ele vale por 1 hora. Não achou? Veja o spam.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Informe o e-mail da sua conta. Enviamos um link para você criar uma senha nova.
      </p>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition"
      >
        {loading ? 'Enviando…' : 'Enviar link'}
      </button>
    </form>
  )
}
