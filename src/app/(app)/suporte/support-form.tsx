'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertTriangle, HelpCircle, Lightbulb, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { sendSupportRequestAction, type SupportFormState } from './actions'
import { SUPPORT_KINDS, type SupportKind } from './support-kinds'

const KIND_ICON: Record<SupportKind, LucideIcon> = {
  duvida: HelpCircle,
  problema: AlertTriangle,
  sugestao: Lightbulb,
}

const initialState: SupportFormState = { ok: false }

export function SupportForm() {
  const [state, formAction] = useActionState(sendSupportRequestAction, initialState)

  useEffect(() => {
    if (state.sentAt) toast.success('Mensagem enviada! Vamos responder no seu e-mail.')
  }, [state.sentAt])

  return (
    <form action={formAction} className="rounded-lg border bg-card p-5 space-y-5">
      {/* A key troca a cada envio bem-sucedido: os campos voltam ao estado inicial.
          Com erro, a key se mantém e o texto digitado não se perde. */}
      <Fields key={state.sentAt ?? 0} state={state} />
    </form>
  )
}

function Fields({ state }: { state: SupportFormState }) {
  const [kind, setKind] = useState<SupportKind>('duvida')
  const [message, setMessage] = useState('')
  const current = SUPPORT_KINDS.find((k) => k.value === kind) ?? SUPPORT_KINDS[0]

  return (
    <>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Sobre o que você quer falar?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {SUPPORT_KINDS.map((k) => {
            const Icon = KIND_ICON[k.value]
            const active = k.value === kind
            return (
              <label
                key={k.value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm transition focus-within:ring-2 focus-within:ring-primary/30 ${
                  active ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k.value}
                  checked={active}
                  onChange={() => setKind(k.value)}
                  className="sr-only"
                />
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`}
                />
                <span>
                  <span className="block font-medium">{k.label}</span>
                  <span className="block text-xs text-muted-foreground">{k.hint}</span>
                </span>
              </label>
            )
          })}
        </div>
        {state.fieldErrors?.kind ? (
          <p className="text-xs text-rose-700">{state.fieldErrors.kind[0]}</p>
        ) : null}
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="support-message" className="text-sm font-medium">
          Mensagem
        </label>
        <textarea
          id="support-message"
          name="message"
          rows={6}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={current.placeholder}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex justify-between gap-2 text-xs">
          <span className="text-rose-700">{state.fieldErrors?.message?.[0] ?? ''}</span>
          <span className="text-muted-foreground tabular-nums">{message.length}/5000</span>
        </div>
      </div>

      {!state.ok && state.message && !state.fieldErrors ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
    >
      {pending ? 'Enviando…' : 'Enviar mensagem'}
    </button>
  )
}
