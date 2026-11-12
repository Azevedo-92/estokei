'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { formatDateBR } from '@/lib/utils'
import { revokeInviteAction } from './actions'

export type PendingInvite = {
  id: string
  email: string | null
  role: string
  expires_at: string
  invited_by_name: string | null
  token: string
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Membro',
}

export function InvitesList({
  invites,
  appUrl,
}: {
  invites: PendingInvite[]
  appUrl: string
}) {
  const [pending, start] = useTransition()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function copyLink(token: string, id: string) {
    const url = `${appUrl.replace(/\/$/, '')}/convite/${token}`
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function onRevoke(id: string) {
    if (!confirm('Revogar este convite? O link deixa de funcionar.')) return
    start(async () => {
      try {
        await revokeInviteAction(id)
        toast.success('Convite revogado.')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao revogar.')
      }
    })
  }

  if (invites.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">Convites pendentes</h2>
      <ul className="rounded-md border bg-card divide-y">
        {invites.map((inv) => (
          <li key={inv.id} className="p-4 flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{inv.email || 'Sem e-mail informado'}</span>
                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs bg-slate-100 text-slate-700 border-slate-200">
                  {ROLE_LABEL[inv.role] ?? inv.role}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Expira em {formatDateBR(inv.expires_at)}
                {inv.invited_by_name ? ` · Enviado por ${inv.invited_by_name}` : ''}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copyLink(inv.token, inv.id)}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent w-28"
              >
                {copiedId === inv.id ? 'Copiado ✓' : 'Copiar link'}
              </button>
              <button
                type="button"
                onClick={() => onRevoke(inv.id)}
                disabled={pending}
                className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/5"
              >
                Revogar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
