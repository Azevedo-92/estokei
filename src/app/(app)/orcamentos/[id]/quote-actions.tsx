'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { INPUT_CLASS, type FormState } from '@/components/form-field'
import { cn } from '@/lib/utils'
import { PAYMENT_LABEL, PAYMENT_METHODS, type PaymentMethod } from '@/lib/pos'
import { cancelQuoteAction, convertQuoteAction } from '../actions'

function Submit({ label, pendingLabel, className }: { label: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={cn(className, 'disabled:opacity-50')}>
      {pending ? pendingLabel : label}
    </button>
  )
}

function useToast(state: FormState) {
  useEffect(() => {
    if (!state.message) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])
}

/** Converter em venda: escolhe o pagamento; preços e desconto são os do orçamento. */
export function ConvertQuoteForm({ quoteId, hasCustomer }: { quoteId: string; hasCustomer: boolean }) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('dinheiro')
  const [state, formAction] = useActionState<FormState, FormData>(convertQuoteAction, { ok: true })
  useToast(state)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Converter em venda
      </button>
    )
  }

  return (
    <form action={formAction} className="w-full space-y-4 rounded-lg border bg-card p-5">
      <input type="hidden" name="quote_id" value={quoteId} />
      <input type="hidden" name="payment_method" value={method} />
      <div>
        <h2 className="font-medium">Converter em venda</h2>
        <p className="text-sm text-muted-foreground">
          Vale o preço e o desconto do orçamento. O estoque é baixado na hora.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            disabled={m === 'fiado' && !hasCustomer}
            title={m === 'fiado' && !hasCustomer ? 'Fiado precisa de cliente cadastrado no orçamento' : undefined}
            className={cn(
              'rounded-md border px-2 py-2 text-sm disabled:opacity-40',
              method === m ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-accent',
            )}
            aria-pressed={method === m}
          >
            {PAYMENT_LABEL[m]}
          </button>
        ))}
      </div>
      {method === 'dinheiro' ? (
        <label className="block max-w-xs space-y-1.5 text-sm">
          <span className="font-medium">Valor recebido (R$, opcional)</span>
          <input name="amount_received" inputMode="decimal" placeholder="0,00" className={INPUT_CLASS} />
        </label>
      ) : null}
      <div className="flex items-center gap-3">
        <Submit
          label="Confirmar venda"
          pendingLabel="Registrando…"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        />
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">
          Voltar
        </button>
      </div>
    </form>
  )
}

export function CancelQuoteButton({ quoteId }: { quoteId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(cancelQuoteAction, { ok: true })
  useToast(state)
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm('Cancelar este orçamento? Ele continua no histórico.')) e.preventDefault()
      }}
    >
      <input type="hidden" name="quote_id" value={quoteId} />
      <Submit
        label="Cancelar orçamento"
        pendingLabel="Cancelando…"
        className="rounded-md border border-rose-200 px-4 py-2 text-sm text-rose-700 hover:bg-rose-50"
      />
    </form>
  )
}
