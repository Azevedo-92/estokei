'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SUSPENSION_REASONS, type OrgStatus } from '@/lib/platform'
import { setOrganizationStatusAction } from './actions'

const OTHER = '__outro__'

export function OrgStatusActions({
  id,
  name,
  status,
}: {
  id: string
  name: string
  status: OrgStatus
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [suspending, setSuspending] = useState(false)

  function change(next: OrgStatus, done: string, reason?: string) {
    start(async () => {
      const res = await setOrganizationStatusAction(id, next, reason)
      if (!res.ok) return void toast.error(res.message)
      toast.success(done)
      setSuspending(false)
      router.refresh()
    })
  }

  const base = 'rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50'

  return (
    <div className="flex justify-end gap-2">
      {status === 'pending' ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => change('active', `${name} liberada. O responsável recebeu um e-mail.`)}
          className={`${base} bg-emerald-600 text-white hover:bg-emerald-700`}
        >
          Liberar
        </button>
      ) : null}
      {status === 'suspended' ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => change('active', `${name} reativada.`)}
          className={`${base} border hover:bg-accent`}
        >
          Reativar
        </button>
      ) : null}
      {status !== 'suspended' ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setSuspending(true)}
          className={`${base} border border-rose-200 text-rose-700 hover:bg-rose-50`}
        >
          Suspender
        </button>
      ) : null}

      {suspending ? (
        <SuspendDialog
          name={name}
          pending={pending}
          onCancel={() => setSuspending(false)}
          onConfirm={(reason) => change('suspended', `${name} suspensa.`, reason)}
        />
      ) : null}
    </div>
  )
}

function SuspendDialog({
  name,
  pending,
  onCancel,
  onConfirm,
}: {
  name: string
  pending: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const [choice, setChoice] = useState<string>(SUSPENSION_REASONS[0])
  const [other, setOther] = useState('')
  const reason = choice === OTHER ? other.trim() : choice

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 text-left"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suspend-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="suspend-title" className="text-base font-semibold">
            Suspender {name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A equipe deixa de entrar no sistema. Os dados continuam guardados e
            dá para reativar a qualquer momento. O motivo aparece para a empresa na tela de aviso.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Motivo</legend>
          {[...SUSPENSION_REASONS, OTHER].map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="motivo"
                value={r}
                checked={choice === r}
                onChange={() => setChoice(r)}
                className="h-4 w-4"
              />
              {r === OTHER ? 'Outro motivo' : r}
            </label>
          ))}
          {choice === OTHER ? (
            <input
              type="text"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              maxLength={200}
              autoFocus
              placeholder="Escreva o motivo"
              aria-label="Outro motivo"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          ) : null}
        </fieldset>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={pending || !reason}
            className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {pending ? 'Suspendendo…' : 'Suspender acesso'}
          </button>
        </div>
      </div>
    </div>
  )
}
