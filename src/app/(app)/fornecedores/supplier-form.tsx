'use client'

import Link from 'next/link'
import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Field, INPUT_CLASS, type FormState } from '@/components/form-field'
import { saveSupplierAction } from './actions'

export type SupplierFormValues = {
  id?: string
  name: string
  document: string
  contact_name: string
  phone: string
  email: string
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

export function SupplierForm({ initial }: { initial: SupplierFormValues }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveSupplierAction, { ok: true })

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
          <Field label="CNPJ ou CPF" hint="Só números" error={err('document')}>
            <input name="document" inputMode="numeric" defaultValue={initial.document} className={INPUT_CLASS} />
          </Field>
          <Field label="Pessoa de contato" error={err('contact_name')}>
            <input name="contact_name" defaultValue={initial.contact_name} maxLength={200} className={INPUT_CLASS} />
          </Field>
          <Field label="Telefone / WhatsApp" error={err('phone')}>
            <input name="phone" inputMode="tel" defaultValue={initial.phone} className={INPUT_CLASS} />
          </Field>
          <Field label="E-mail" error={err('email')}>
            <input name="email" type="email" defaultValue={initial.email} className={INPUT_CLASS} />
          </Field>
        </div>

        <Field label="Observações" error={err('notes')}>
          <textarea name="notes" rows={3} defaultValue={initial.notes} maxLength={2000} className={INPUT_CLASS} />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input type="hidden" name="active" value="false" />
          <input type="checkbox" name="active" value="true" defaultChecked={initial.active} />
          Fornecedor ativo
        </label>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton label={initial.id ? 'Salvar alterações' : 'Cadastrar fornecedor'} />
        <Link href="/fornecedores" className="text-sm text-muted-foreground hover:text-foreground">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
