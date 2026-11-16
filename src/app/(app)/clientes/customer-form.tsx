'use client'

import Link from 'next/link'
import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Field, INPUT_CLASS, type FormState } from '@/components/form-field'
import { saveCustomerAction } from './actions'

export type CustomerFormValues = {
  id?: string
  name: string
  document: string
  phone: string
  email: string
  address: string
  notes: string
  active: boolean
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {pending ? 'Salvando…' : label}
    </button>
  )
}

export function CustomerForm({ initial }: { initial: CustomerFormValues }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveCustomerAction, { ok: true })

  useEffect(() => {
    if (state.message && !state.ok) toast.error(state.message)
  }, [state])

  const err = (n: string) => state.fieldErrors?.[n]?.[0]

  return (
    <form action={formAction} className="space-y-6">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <section className="rounded-lg border bg-card p-6 space-y-4">
        <Field label="Nome" required error={err('name')}>
          <input name="name" required defaultValue={initial.name} maxLength={200} className={INPUT_CLASS} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CPF ou CNPJ" hint="Opcional" error={err('document')}>
            <input name="document" inputMode="numeric" defaultValue={initial.document} className={INPUT_CLASS} />
          </Field>
          <Field label="Telefone / WhatsApp" error={err('phone')}>
            <input name="phone" inputMode="tel" defaultValue={initial.phone} className={INPUT_CLASS} />
          </Field>
          <Field label="E-mail" error={err('email')}>
            <input name="email" type="email" defaultValue={initial.email} className={INPUT_CLASS} />
          </Field>
        </div>

        <Field label="Endereço" error={err('address')}>
          <input name="address" defaultValue={initial.address} maxLength={500} className={INPUT_CLASS} />
        </Field>

        <Field label="Observações" error={err('notes')}>
          <textarea name="notes" rows={3} defaultValue={initial.notes} maxLength={2000} className={INPUT_CLASS} />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input type="hidden" name="active" value="false" />
          <input type="checkbox" name="active" value="true" defaultChecked={initial.active} />
          Cliente ativo
        </label>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton label={initial.id ? 'Salvar alterações' : 'Cadastrar cliente'} />
        <Link href="/clientes" className="text-sm text-muted-foreground hover:text-foreground">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
