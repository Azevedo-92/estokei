import Link from 'next/link'
import { EstokeiMark } from '@/components/estokei-mark'
import { createClient } from '@/lib/supabase/server'
import { NewPasswordForm } from './new-password-form'

export const metadata = { title: 'Nova senha' }

/** Aberta pelo link do e-mail de redefinição (já com a sessão de recuperação). */
export default async function NovaSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string }>
}) {
  const { convite } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const next = convite ? `/convite/${encodeURIComponent(convite)}` : '/painel'

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <EstokeiMark />
          <p className="mt-6 text-sm text-muted-foreground">Criar uma senha nova</p>
        </div>
        <div className="card-elev p-6 shadow-sm">
          {user ? (
            <NewPasswordForm email={user.email ?? ''} next={next} />
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-medium">Link expirado ou já usado</p>
              <p className="text-muted-foreground">
                Peça um link novo para criar sua senha.
              </p>
              <Link
                href={convite ? `/redefinir-senha?convite=${encodeURIComponent(convite)}` : '/redefinir-senha'}
                className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Pedir novo link
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
