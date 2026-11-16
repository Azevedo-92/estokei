import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDateBR } from '@/lib/utils'
import { AcceptButton } from './accept-button'
import { SwitchAccountButton } from './switch-account-button'

export const metadata = { title: 'Convite' }

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now()
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Dono',
  admin: 'Administrador',
  member: 'Membro',
}

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data: user } = await supabase.auth.getUser()
  const { data: rows } = await supabase.rpc('get_invite_summary', { invite_token: token })
  const invite = Array.isArray(rows) ? rows[0] : null

  const expired = invite && isExpired(invite.expires_at)
  const already = invite?.already_accepted
  // Convite com e-mail só vale para aquela conta (o banco também confere).
  const wrongAccount =
    !!invite?.email &&
    !!user.user?.email &&
    invite.email.trim().toLowerCase() !== user.user.email.trim().toLowerCase()

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Estokei</h1>
        </div>

        {!invite ? (
          <div className="rounded-lg border bg-card p-6 text-center space-y-3">
            <h2 className="text-lg font-semibold">Convite não encontrado</h2>
            <p className="text-sm text-muted-foreground">
              Este link pode ter sido revogado ou digitado incorretamente.
            </p>
            <Link href="/entrar" className="text-sm underline">
              Ir para o login
            </Link>
          </div>
        ) : already ? (
          <div className="rounded-lg border bg-card p-6 text-center space-y-3">
            <h2 className="text-lg font-semibold">Convite já utilizado</h2>
            <p className="text-sm text-muted-foreground">
              Este convite já foi aceito. Faça login com sua conta para acessar.
            </p>
            <Link href="/entrar" className="text-sm underline">
              Ir para o login
            </Link>
          </div>
        ) : expired ? (
          <div className="rounded-lg border bg-card p-6 text-center space-y-3">
            <h2 className="text-lg font-semibold">Convite expirado</h2>
            <p className="text-sm text-muted-foreground">
              Expirou em {formatDateBR(invite.expires_at)}. Peça um novo link para{' '}
              {invite.invited_by_name ?? 'o administrador'}.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="text-center space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Você foi convidado para
              </div>
              <div className="text-xl font-semibold">{invite.organization_name}</div>
              <div className="text-sm text-muted-foreground">
                como {ROLE_LABEL[invite.role] ?? invite.role}
                {invite.invited_by_name ? ` por ${invite.invited_by_name}` : ''}
              </div>
            </div>

            {user.user && wrongAccount ? (
              <div className="space-y-3">
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Este convite foi enviado para <strong>{invite.email}</strong>, mas você está
                  conectado como <strong>{user.user.email}</strong>. Entre com a conta convidada
                  para aceitar.
                </p>
                <SwitchAccountButton token={token} />
              </div>
            ) : user.user ? (
              <AcceptButton token={token} />
            ) : (
              <div className="space-y-3">
                <p className="text-center text-sm text-muted-foreground">
                  Para aceitar, entre com sua conta ou crie uma nova.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link
                    href={`/entrar?convite=${encodeURIComponent(token)}`}
                    className="rounded-md border px-4 py-2 text-sm text-center hover:bg-accent"
                  >
                    Já tenho conta
                  </Link>
                  <Link
                    href={`/cadastrar?convite=${encodeURIComponent(token)}${
                      invite.email ? `&email=${encodeURIComponent(invite.email)}` : ''
                    }`}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground text-center hover:bg-primary/90"
                  >
                    Criar conta
                  </Link>
                </div>
              </div>
            )}

            <div className="text-center text-xs text-muted-foreground">
              Convite expira em {formatDateBR(invite.expires_at)}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
