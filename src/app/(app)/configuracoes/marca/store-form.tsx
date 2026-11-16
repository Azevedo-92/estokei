'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Field, INPUT_CLASS, type FormState } from '@/components/form-field'
import type { StoreProfile } from '@/lib/store-profile'
import { saveStoreProfileAction } from './store-actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {pending ? 'Salvando…' : 'Salvar dados da loja'}
    </button>
  )
}

export function StoreForm({ initial }: { initial: StoreProfile }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveStoreProfileAction, { ok: true })

  useEffect(() => {
    if (!state.message) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])

  const err = (n: string) => state.fieldErrors?.[n]?.[0]

  return (
    <form action={formAction} className="rounded-lg border bg-card p-6 space-y-4">
      <div>
        <h2 className="font-medium">Dados da loja</h2>
        <p className="text-sm text-muted-foreground">Aparecem no cabeçalho dos orçamentos em PDF.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CNPJ ou CPF" error={err('document')}>
          <input name="document" inputMode="numeric" defaultValue={initial.document ?? ''} className={INPUT_CLASS} />
        </Field>
        <Field label="Telefone / WhatsApp" error={err('phone')}>
          <input name="phone" inputMode="tel" defaultValue={initial.phone ?? ''} className={INPUT_CLASS} />
        </Field>
        <Field label="E-mail" error={err('email')}>
          <input name="email" type="email" defaultValue={initial.email ?? ''} className={INPUT_CLASS} />
        </Field>
        <Field label="Endereço" error={err('address')}>
          <input name="address" maxLength={300} defaultValue={initial.address ?? ''} className={INPUT_CLASS} />
        </Field>
      </div>
      <SubmitButton />
    </form>
  )
}
