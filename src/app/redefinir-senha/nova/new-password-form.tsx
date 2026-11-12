'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

export function NewPasswordForm({ email, next }: { email: string; next: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const password = (form.elements.namedItem('password') as HTMLInputElement).value
    const confirm = (form.elements.namedItem('confirm') as HTMLInputElement).value

    if (password.length < 8) return setError('Use pelo menos 8 caracteres.')
    if (password !== confirm) return setError('As duas senhas não são iguais.')
    setError(null)

    setLoading(true)
    const { error: updateError } = await createClient().auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      toast.error('Não foi possível salvar a senha', { description: updateError.message })
      return
    }
    toast.success('Senha criada! Você já está conectado.')
    router.push(next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {email ? (
        <p className="text-sm text-muted-foreground">
          Conta: <strong className="text-foreground">{email}</strong>
        </p>
      ) : null}
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Nova senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="confirm" className="text-sm font-medium">
          Repita a nova senha
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
        />
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition"
      >
        {loading ? 'Salvando…' : 'Salvar nova senha'}
      </button>
    </form>
  )
}
