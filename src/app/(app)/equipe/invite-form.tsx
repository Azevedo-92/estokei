'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { createInviteAction, type InviteState } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {pending ? 'Gerando…' : 'Gerar link de convite'}
    </button>
  )
}

export function InviteForm() {
  const [state, action] = useActionState<InviteState, FormData>(createInviteAction, {
    ok: true,
  })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!state.message) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])

  async function copyLink() {
    if (!state.inviteUrl) return
    await navigator.clipboard.writeText(state.inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <h2 className="text-base font-semibold">Convidar novo membro</h2>
      <p className="text-xs text-muted-foreground">
        Enquanto o envio automático de e-mail não estiver ativo, você gera o link aqui e
        envia manualmente ao convidado.
      </p>
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr,140px,auto]">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            E-mail (opcional, só para lembrete)
          </label>
          <input
            name="email"
            type="email"
            placeholder="pessoa@empresa.com"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Papel</label>
          <select
            name="role"
            defaultValue="member"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="member">Membro</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex items-end">
          <SubmitButton />
        </div>
      </form>

      {state.inviteUrl ? (
        <div className="rounded-md border bg-muted/40 p-3 space-y-2">
          <div className="text-xs text-muted-foreground">Link do convite (expira em 14 dias)</div>
          <div className="flex gap-2">
            <input
              readOnly
              value={state.inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border bg-background px-3 py-2 text-xs font-mono outline-none"
            />
            <button
              type="button"
              onClick={copyLink}
              className="rounded-md border px-3 py-2 text-xs hover:bg-accent w-24"
            >
              {copied ? 'Copiado ✓' : 'Copiar'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
