'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { TERMS_VERSION } from '@/app/(marketing)/legal'
import { getPlan } from '@/lib/plans'

export function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const convite = searchParams.get('convite')
  const invitedEmail = searchParams.get('email')
  const desiredPlan = searchParams.get('plano')
  const ciclo = searchParams.get('ciclo')
  const desiredCycle = ciclo === 'anual' ? 'yearly' : ciclo === 'mensal' ? 'monthly' : null
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fullName = (form.elements.namedItem('fullName') as HTMLInputElement).value
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value

    const nextPath = convite ? `/convite/${encodeURIComponent(convite)}` : '/onboard'

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Registro do aceite dos termos (LGPD): quando e qual versão.
        data: {
          full_name: fullName,
          terms_accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION,
          // Plano clicado na página de preços: vem marcado na tela de pagamento.
          ...(getPlan(desiredPlan) ? { desired_plan: desiredPlan } : {}),
          ...(desiredCycle ? { desired_cycle: desiredCycle } : {}),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          nextPath
        )}`,
      },
    })
    setLoading(false)

    if (error) {
      toast.error('Não foi possível criar a conta', { description: error.message })
      return
    }

    if (data.session) {
      router.push(nextPath)
      router.refresh()
    } else {
      toast.success('Verifique seu e-mail', {
        description: 'Enviamos um link para confirmar sua conta.',
      })
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="fullName" className="text-sm font-medium">
          Nome completo
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          autoComplete="name"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
        />
      </div>
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
          defaultValue={invitedEmail ?? ''}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Senha
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
        <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
      </div>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input id="terms" name="terms" type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Li e aceito os{' '}
          <Link href="/termos" target="_blank" className="underline hover:text-foreground">
            Termos de Uso
          </Link>{' '}
          e a{' '}
          <Link href="/privacidade" target="_blank" className="underline hover:text-foreground">
            Política de Privacidade
          </Link>
          .
        </span>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition"
      >
        {loading ? 'Criando…' : 'Criar conta'}
      </button>
    </form>
  )
}
