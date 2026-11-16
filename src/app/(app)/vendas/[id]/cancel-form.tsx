'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Field, INPUT_CLASS, type FormState } from '@/components/form-field'
import { cancelSaleAction } from '../actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
    >
      {pending ? 'Cancelando…' : 'Confirmar cancelamento'}
    </button>
  )
}

export function CancelSaleForm({ saleId }: { saleId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState<FormState, FormData>(cancelSaleAction, { ok: true })

  useEffect(() => {
    if (!state.message) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-rose-200 px-4 py-2 text-sm text-rose-700 hover:bg-rose-50"
      >
        Cancelar venda
      </button>
    )
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-rose-200 bg-rose-50/50 p-4">
      <input type="hidden" name="sale_id" value={saleId} />
      <p className="text-sm">
        Cancelar devolve os produtos ao estoque. A venda continua no histórico, marcada como cancelada.
      </p>
      <Field label="Motivo" required error={state.fieldErrors?.reason?.[0]}>
        <input name="reason" required minLength={3} maxLength={500} className={INPUT_CLASS} autoFocus />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton />
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">
          Voltar
        </button>
      </div>
    </form>
  )
}
