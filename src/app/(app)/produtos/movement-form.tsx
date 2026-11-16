'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Field, INPUT_CLASS, type FormState } from '@/components/form-field'
import { MANUAL_MOVEMENT_KINDS, MOVEMENT_LABEL, type ManualMovementKind } from '@/lib/stock'
import { recordMovementAction } from './actions'
import type { SupplierOption } from './product-form'

const QUANTITY_LABEL: Record<ManualMovementKind, string> = {
  entrada: 'Quantidade que entrou',
  perda: 'Quantidade perdida',
  ajuste: 'Quantidade contada (novo saldo)',
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {pending ? 'Registrando…' : 'Registrar'}
    </button>
  )
}

export function MovementForm({
  productId,
  unit,
  suppliers,
  defaultSupplierId,
}: {
  productId: string
  unit: string
  suppliers: SupplierOption[]
  defaultSupplierId: string
}) {
  const [state, formAction] = useActionState<FormState, FormData>(recordMovementAction, { ok: true })
  const [kind, setKind] = useState<ManualMovementKind>('entrada')
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!state.message) return
    if (state.ok) {
      toast.success(state.message)
      formRef.current?.reset()
    } else {
      toast.error(state.message)
    }
  }, [state])

  const err = (n: string) => state.fieldErrors?.[n]?.[0]

  return (
    <form ref={formRef} action={formAction} className="rounded-lg border bg-card p-6 space-y-4">
      <input type="hidden" name="product_id" value={productId} />
      <h2 className="font-medium">Movimentar estoque</h2>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de movimento">
        {MANUAL_MOVEMENT_KINDS.map((k) => (
          <label
            key={k}
            className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${
              kind === k ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-accent'
            }`}
          >
            <input
              type="radio"
              name="kind"
              value={k}
              checked={kind === k}
              onChange={() => setKind(k)}
              className="sr-only"
            />
            {MOVEMENT_LABEL[k]}
          </label>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`${QUANTITY_LABEL[kind]} (${unit})`} required error={err('quantity')}>
          <input name="quantity" inputMode="decimal" required className={INPUT_CLASS} />
        </Field>
        {kind === 'entrada' ? (
          <Field label="Custo unitário (R$)" hint="Se preencher, atualiza o preço de custo" error={err('unit_cost')}>
            <input name="unit_cost" inputMode="decimal" placeholder="0,00" className={INPUT_CLASS} />
          </Field>
        ) : null}
      </div>

      {kind === 'entrada' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fornecedor" error={err('supplier_id')}>
            <select name="supplier_id" defaultValue={defaultSupplierId} className={INPUT_CLASS}>
              <option value="">— Nenhum —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nota fiscal / referência" error={err('reference')}>
            <input name="reference" maxLength={100} className={INPUT_CLASS} />
          </Field>
        </div>
      ) : null}

      <Field
        label="Observação"
        hint={kind === 'perda' ? 'Ex.: quebra, vencimento, furto' : kind === 'ajuste' ? 'Ex.: inventário de novembro' : undefined}
        error={err('notes')}
      >
        <input name="notes" maxLength={500} className={INPUT_CLASS} />
      </Field>

      <SubmitButton />
    </form>
  )
}
