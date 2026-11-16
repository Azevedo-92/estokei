import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { cn, formatCurrencyBRL, formatDateBR, todayISO } from '@/lib/utils'
import { toInputBR } from '@/lib/stock'
import {
  ENTRY_STATUS_CHIP,
  ENTRY_STATUS_LABEL,
  FINANCE_METHOD_LABEL,
  KIND_LABEL,
  entryDisplayStatus,
  type EntryKind,
  type FinanceMethod,
} from '@/lib/finance'
import { EditEntryForm, EntryActions, PayEntryForm } from '../entry-forms'
import { loadParties } from '../parties'

export const metadata = { title: 'Conta' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ContaPage({ params }: { params: Promise<{ id: string }> }) {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) notFound()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const supabase = await createClient()
  const { data: e } = await supabase
    .from('financial_entries')
    .select(
      'id, kind, description, category, customer_id, supplier_id, amount, due_date, status, paid_at, paid_amount, payment_method, sale_id, installment, installments, group_id, notes, customers(id, name), suppliers(id, name), sales(id, number)',
    )
    .eq('id', id)
    .eq('organization_id', organization.id)
    .maybeSingle()
  if (!e) notFound()

  const kind = e.kind as EntryKind
  const today = todayISO()
  const st = entryDisplayStatus(e.status, e.due_date, today)
  const partyId = kind === 'receber' ? e.customer_id : e.supplier_id
  const party = kind === 'receber' ? e.customers : e.suppliers
  const parties = e.status === 'cancelado' ? [] : await loadParties(supabase, organization.id, kind, partyId)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href={`/financeiro?tipo=${kind}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {KIND_LABEL[kind]}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{e.description}</h1>
          <span className={cn('rounded-full border px-2 py-0.5 text-xs', ENTRY_STATUS_CHIP[st])}>
            {ENTRY_STATUS_LABEL[kind][st]}
          </span>
        </div>
      </div>

      <section className="grid gap-3 rounded-lg border bg-card p-5 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Valor</p>
          <p className="text-lg font-semibold tabular-nums">{formatCurrencyBRL(e.amount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Vencimento</p>
          <p className={cn('font-medium', st === 'vencido' && 'text-rose-700')}>{formatDateBR(e.due_date)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{kind === 'receber' ? 'Cliente' : 'Fornecedor'}</p>
          {party ? (
            <Link
              href={kind === 'receber' ? `/clientes/${party.id}` : `/fornecedores/${party.id}`}
              className="font-medium hover:underline"
            >
              {party.name}
            </Link>
          ) : (
            <p className="font-medium">—</p>
          )}
        </div>
        {e.installments ? (
          <div>
            <p className="text-xs text-muted-foreground">Parcela</p>
            <p className="font-medium">
              {e.installment} de {e.installments}
            </p>
          </div>
        ) : null}
        {e.sales ? (
          <div>
            <p className="text-xs text-muted-foreground">Origem</p>
            <Link href={`/vendas/${e.sales.id}`} className="font-medium hover:underline">
              Venda #{e.sales.number} (fiado)
            </Link>
          </div>
        ) : null}
        {e.status === 'pago' ? (
          <div>
            <p className="text-xs text-muted-foreground">{kind === 'receber' ? 'Recebida' : 'Paga'}</p>
            <p className="font-medium">
              {formatDateBR(e.paid_at)} · {formatCurrencyBRL(e.paid_amount)}
              {e.payment_method ? ` · ${FINANCE_METHOD_LABEL[e.payment_method as FinanceMethod] ?? e.payment_method}` : ''}
            </p>
          </div>
        ) : null}
      </section>

      {e.status === 'aberto' ? (
        <PayEntryForm id={e.id} kind={kind} amount={toInputBR(e.amount, 2)} today={today} />
      ) : null}

      {e.sale_id && e.status === 'aberto' ? (
        <p className="text-sm text-muted-foreground">
          Conta de venda fiado: para cancelar, cancele a venda (o estoque volta junto).
        </p>
      ) : null}

      <EntryActions id={e.id} kind={kind} status={e.status} linkedToSale={Boolean(e.sale_id)} />

      {e.status !== 'cancelado' ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium">Editar conta</summary>
          <div className="mt-4">
            <EditEntryForm
              parties={parties}
              entry={{
                id: e.id,
                kind,
                description: e.description,
                category: e.category ?? '',
                party_id: partyId ?? '',
                amount: toInputBR(e.amount, 2),
                due_date: e.due_date,
                notes: e.notes ?? '',
                linkedToSale: Boolean(e.sale_id),
              }}
            />
          </div>
        </details>
      ) : e.notes ? (
        <p className="whitespace-pre-line rounded-lg border bg-card p-4 text-sm">{e.notes}</p>
      ) : null}
    </div>
  )
}
