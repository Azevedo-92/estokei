import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDateBR } from '@/lib/utils'
import { OnboardForm } from './onboard-form'

export const metadata = { title: 'Configurar sua empresa' }

export default async function OnboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  // If the user already belongs to at least one org, skip onboarding
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)

  if (memberships && memberships.length > 0) {
    redirect('/painel')
  }

  // Quem foi convidado vê o convite antes — para não criar uma empresa
  // duplicada achando que precisa.
  const { data: invites } = await supabase.rpc('my_pending_invites')
  const pending = invites ?? []

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        {pending.length > 0 ? (
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Você tem um convite</h1>
              <p className="text-sm text-muted-foreground">
                Para usar o Estokei com a sua equipe, aceite o convite — não crie uma
                empresa nova.
              </p>
            </div>
            <ul className="space-y-2">
              {pending.map((i) => (
                <li key={i.token}>
                  <Link
                    href={`/convite/${encodeURIComponent(i.token)}`}
                    className="flex items-center justify-between gap-3 rounded-md border px-4 py-3 hover:bg-accent"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{i.organization_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        Válido até {formatDateBR(i.expires_at)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-primary">Ver convite →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <div className="mb-8 text-center">
            <h2 className={`${pending.length > 0 ? 'text-lg' : 'text-3xl'} font-semibold tracking-tight`}>
              {pending.length > 0 ? 'Ou crie uma empresa nova' : 'Vamos configurar sua empresa'}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {pending.length > 0
                ? 'Só se você quer um espaço separado, sem a equipe que convidou você.'
                : 'Este será o espaço da sua equipe dentro do Estokei.'}
            </p>
          </div>
          <OnboardForm />
        </div>
      </div>
    </main>
  )
}
