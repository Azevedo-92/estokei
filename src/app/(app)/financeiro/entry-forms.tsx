'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Field, INPUT_CLASS, type FormState } from '@/components/form-field'
import { cn, formatCurrencyBRL, formatDateBR } from '@/lib/utils'
import { parseDecimalBR } from '@/lib/stock'
import {
  CATEGORY_SUGGESTIONS,
  FINANCE_METHOD_LABEL,
  FINANCE_METHODS,
  installmentDates,
  splitInstallments,
  type EntryKind,
} from '@/lib/finance'
import {
  cancelEntryAction,
  createEntryAction,
  deleteEntryAction,
  payEntryAction,
  reopenEntryAction,
  updateEntryAction,
} from './actions'

export type PartyOption = { id: string; name: string }

function Submit({ label, pending: pendingLabel = 'Salvando…', className }: { label: string; pending?: string; className?: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50',
        className,
      )}
    >
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

export function NewEntryForm({
  kind,
  parties,
  today,
}: {
  kind: EntryKind
  parties: PartyOption[]
  today: string
}) {
  const [state, formAction] = useActionState<FormState, FormData>(createEntryAction, { ok: true })
  useToast(state)
  const [amountText, setAmountText] = useState('')
  const [dueDate, setDueDate] = useState(today)
  const [installments, setInstallments] = useState(1)
  const [paidNow, setPaidNow] = useState(false)
  const err = (n: string) => state.fieldErrors?.[n]?.[0]

  const amount = parseDecimalBR(amountText)
  const preview =
    amount && amount > 0 && installments > 1 && installments <= 60 && dueDate
      ? splitInstallments(amount, installments).map((v, i) => ({ v, d: installmentDates(dueDate, installments)[i] }))
      : null

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="kind" value={kind} />
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <Field label="Descrição" required error={err('description')}>
          <input
            name="description"
            required
            maxLength={200}
            placeholder={kind === 'pagar' ? 'Ex.: NF 1234 Votoran, aluguel de novembro' : 'Ex.: Serviço de entrega'}
            className={INPUT_CLASS}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria" error={err('category')}>
            <input name="category" list="categorias" maxLength={60} className={INPUT_CLASS} />
            <datalist id="categorias">
              {CATEGORY_SUGGESTIONS[kind].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label={kind === 'receber' ? 'Cliente' : 'Fornecedor'} error={err('party_id')}>
            <select name="party_id" defaultValue="" className={INPUT_CLASS}>
              <option value="">— Nenhum —</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={installments > 1 ? 'Valor total (R$)' : 'Valor (R$)'} required error={err('amount')}>
            <input
              name="amount"
              required
              inputMode="decimal"
              placeholder="0,00"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label={installments > 1 ? '1º vencimento' : 'Vencimento'} required error={err('due_date')}>
            <input
              type="date"
              name="due_date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Parcelas" hint="Mensais, a partir do 1º vencimento" error={err('installments')}>
            <input
              type="number"
              name="installments"
              min={1}
              max={60}
              value={installments}
              disabled={paidNow}
              onChange={(e) => setInstallments(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        {preview ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="mb-1 font-medium">Parcelas</p>
            <ul className="grid gap-1 sm:grid-cols-3">
              {preview.map((p, i) => (
                <li key={i} className="tabular-nums">
                  {i + 1}ª · {formatDateBR(p.d)} · {formatCurrencyBRL(p.v)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Field label="Observações" error={err('notes')}>
          <textarea name="notes" rows={2} maxLength={1000} className={INPUT_CLASS} />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="paid_now"
            checked={paidNow}
            onChange={(e) => {
              setPaidNow(e.target.checked)
              if (e.target.checked) setInstallments(1)
            }}
          />
          Já foi {kind === 'receber' ? 'recebida' : 'paga'} hoje
        </label>
        {paidNow ? (
          <Field label="Forma de pagamento" error={err('payment_method')}>
            <select name="payment_method" defaultValue="pix" className={`${INPUT_CLASS} max-w-xs`}>
              {FINANCE_METHODS.map((m) => (
                <option key={m} value={m}>
                  {FINANCE_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </section>
      <div className="flex items-center gap-3">
        <Submit label={installments > 1 ? `Criar ${installments} parcelas` : 'Salvar conta'} />
        <Link href={`/financeiro?tipo=${kind}`} className="text-sm text-muted-foreground hover:text-foreground">
          Cancelar
        </Link>
      </div>
    </form>
  )
}

export type EntryValues = {
  id: string
  kind: EntryKind
  description: string
  category: string
  party_id: string
  amount: string
  due_date: string
  notes: string
  linkedToSale: boolean
}

export function EditEntryForm({ entry, parties }: { entry: EntryValues; parties: PartyOption[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(updateEntryAction, { ok: true })
  useToast(state)
  const err = (n: string) => state.fieldErrors?.[n]?.[0]
  return (
    <form action={formAction} className="rounded-lg border bg-card p-6 space-y-4">
      <input type="hidden" name="id" value={entry.id} />
      <input type="hidden" name="kind" value={entry.kind} />
      <Field label="Descrição" required error={err('description')}>
        <input name="description" required maxLength={200} defaultValue={entry.description} className={INPUT_CLASS} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoria" error={err('category')}>
          <input name="category" list="categorias" maxLength={60} defaultValue={entry.category} className={INPUT_CLASS} />
          <datalist id="categorias">
            {CATEGORY_SUGGESTIONS[entry.kind].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label={entry.kind === 'receber' ? 'Cliente' : 'Fornecedor'} error={err('party_id')}>
          <select name="party_id" defaultValue={entry.party_id} className={INPUT_CLASS} disabled={entry.linkedToSale}>
            <option value="">— Nenhum —</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {entry.linkedToSale ? <input type="hidden" name="party_id" value={entry.party_id} /> : null}
        </Field>
        <Field label="Valor (R$)" required error={err('amount')}>
          <input name="amount" required inputMode="decimal" defaultValue={entry.amount} className={INPUT_CLASS} />
        </Field>
        <Field label="Vencimento" required error={err('due_date')}>
          <input type="date" name="due_date" required defaultValue={entry.due_date} className={INPUT_CLASS} />
        </Field>
      </div>
      <Field label="Observações" error={err('notes')}>
        <textarea name="notes" rows={2} maxLength={1000} defaultValue={entry.notes} className={INPUT_CLASS} />
      </Field>
      <Submit label="Salvar alterações" />
    </form>
  )
}

export function PayEntryForm({ id, kind, amount, today }: { id: string; kind: EntryKind; amount: string; today: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(payEntryAction, { ok: true })
  useToast(state)
  const err = (n: string) => state.fieldErrors?.[n]?.[0]
  return (
    <form action={formAction} className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-6 space-y-4">
      <input type="hidden" name="id" value={id} />
      <h2 className="font-medium">{kind === 'receber' ? 'Registrar recebimento' : 'Registrar pagamento'}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Data" required error={err('paid_at')}>
          <input type="date" name="paid_at" required defaultValue={today} max={today} className={INPUT_CLASS} />
        </Field>
        <Field label="Valor (R$)" required error={err('paid_amount')}>
          <input name="paid_amount" required inputMode="decimal" defaultValue={amount} className={INPUT_CLASS} />
        </Field>
        <Field label="Forma" required error={err('payment_method')}>
          <select name="payment_method" defaultValue="pix" className={INPUT_CLASS}>
            {FINANCE_METHODS.map((m) => (
              <option key={m} value={m}>
                {FINANCE_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Submit label={kind === 'receber' ? 'Confirmar recebimento' : 'Confirmar pagamento'} pending="Registrando…" />
    </form>
  )
}

function SmallAction({
  action,
  id,
  kind,
  label,
  confirmText,
  danger,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  id: string
  kind: EntryKind
  label: string
  confirmText: string
  danger?: boolean
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, { ok: true })
  useToast(state)
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <Submit
        label={label}
        pending="…"
        className={
          danger
            ? 'border border-rose-200 bg-transparent text-rose-700 hover:bg-rose-50'
            : 'border bg-transparent text-foreground hover:bg-accent'
        }
      />
    </form>
  )
}

export function EntryActions({
  id,
  kind,
  status,
  linkedToSale,
}: {
  id: string
  kind: EntryKind
  status: string
  linkedToSale: boolean
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {status === 'pago' ? (
        <SmallAction
          action={reopenEntryAction}
          id={id}
          kind={kind}
          label="Estornar baixa"
          confirmText="Desfazer a baixa? A conta volta para em aberto."
        />
      ) : null}
      {status === 'aberto' && !linkedToSale ? (
        <SmallAction
          action={cancelEntryAction}
          id={id}
          kind={kind}
          label="Cancelar conta"
          confirmText="Cancelar esta conta? Ela continua no histórico."
          danger
        />
      ) : null}
      {!linkedToSale ? (
        <SmallAction
          action={deleteEntryAction}
          id={id}
          kind={kind}
          label="Excluir"
          confirmText="Excluir esta conta de vez? Não dá para desfazer."
          danger
        />
      ) : null}
    </div>
  )
}
