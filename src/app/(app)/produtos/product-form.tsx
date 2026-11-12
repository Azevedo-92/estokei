'use client'

import Link from 'next/link'
import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Field, INPUT_CLASS, type FormState } from '@/components/form-field'
import { COMMON_UNITS } from '@/lib/stock'
import { saveProductAction } from './actions'

export type ProductFormValues = {
  id?: string
  code: string
  name: string
  barcode: string
  unit: string
  cost_price: string
  sale_price: string
  min_stock: string
  supplier_id: string
  active: boolean
}

export type SupplierOption = { id: string; name: string }

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

export function ProductForm({ initial, suppliers }: { initial: ProductFormValues; suppliers: SupplierOption[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveProductAction, { ok: true })

  useEffect(() => {
    if (state.message && !state.ok) toast.error(state.message)
  }, [state])

  const err = (n: string) => state.fieldErrors?.[n]?.[0]
  const isNew = !initial.id

  return (
    <form action={formAction} className="space-y-6">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <section className="rounded-lg border bg-card p-6 space-y-4">
        <Field label="Nome" required error={err('name')}>
          <input name="name" required defaultValue={initial.name} maxLength={200} className={INPUT_CLASS} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Código" hint={isNew ? 'Deixe vazio para gerar (P00001…)' : undefined} error={err('code')}>
            <input name="code" defaultValue={initial.code} maxLength={40} className={INPUT_CLASS} />
          </Field>
          <Field label="Código de barras" hint="EAN, só números" error={err('barcode')}>
            <input name="barcode" inputMode="numeric" defaultValue={initial.barcode} className={INPUT_CLASS} />
          </Field>
          <Field label="Unidade" required error={err('unit')}>
            <input
              name="unit"
              list="unidades"
              required
              defaultValue={initial.unit}
              maxLength={10}
              className={INPUT_CLASS}
            />
            <datalist id="unidades">
              {COMMON_UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Preço de custo (R$)" error={err('cost_price')}>
            <input name="cost_price" inputMode="decimal" defaultValue={initial.cost_price} placeholder="0,00" className={INPUT_CLASS} />
          </Field>
          <Field label="Preço de venda (R$)" required error={err('sale_price')}>
            <input name="sale_price" inputMode="decimal" defaultValue={initial.sale_price} placeholder="0,00" className={INPUT_CLASS} />
          </Field>
          <Field label="Estoque mínimo" hint="Avisa quando o saldo chegar nele" error={err('min_stock')}>
            <input name="min_stock" inputMode="decimal" defaultValue={initial.min_stock} placeholder="0" className={INPUT_CLASS} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fornecedor principal" error={err('supplier_id')}>
            <select name="supplier_id" defaultValue={initial.supplier_id} className={INPUT_CLASS}>
              <option value="">— Nenhum —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {isNew ? (
            <Field label="Estoque inicial" hint="Entra como a primeira movimentação" error={err('initial_stock')}>
              <input name="initial_stock" inputMode="decimal" placeholder="0" className={INPUT_CLASS} />
            </Field>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="hidden" name="active" value="false" />
          <input type="checkbox" name="active" value="true" defaultChecked={initial.active} />
          Produto ativo (aparece nas buscas e no PDV)
        </label>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton label={isNew ? 'Cadastrar produto' : 'Salvar alterações'} />
        <Link href="/produtos" className="text-sm text-muted-foreground hover:text-foreground">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
