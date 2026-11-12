import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TIMEZONE } from '@/lib/utils'
import { SupportForm } from './support-form'
import { supportKindLabel } from './support-kinds'

export const metadata = { title: 'Suporte' }

const KIND_CHIP: Record<string, string> = {
  duvida: 'bg-sky-100 text-sky-800 border-sky-200',
  problema: 'bg-rose-100 text-rose-800 border-rose-200',
  sugestao: 'bg-amber-100 text-amber-800 border-amber-200',
}

export default async function SuportePage() {
  const { organization, user } = await requireOrganization()
  const supabase = await createClient()

  const { data: requests } = await supabase
    .from('support_requests')
    .select('id, kind, message, created_at')
    .eq('organization_id', organization.id)
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const sentAt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  })

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Suporte</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tem uma dúvida, encontrou um problema ou quer sugerir uma melhoria? Escreva
          abaixo para a equipe do Estokei. A resposta chega no seu e-mail
          {user.email ? (
            <>
              , <strong className="text-foreground">{user.email}</strong>
            </>
          ) : null}
          .
        </p>
      </header>

      <SupportForm />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Suas mensagens</h2>
        {!requests || requests.length === 0 ? (
          <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
            Você ainda não enviou nenhuma mensagem.
          </p>
        ) : (
          <ul className="rounded-md border bg-card divide-y">
            {requests.map((r) => (
              <li key={r.id} className="p-4 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                      KIND_CHIP[r.kind] ?? 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {supportKindLabel(r.kind)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Enviada em {sentAt.format(new Date(r.created_at))}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap line-clamp-4">{r.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
