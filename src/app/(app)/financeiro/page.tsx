import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { cn, formatCurrencyBRL, formatDateBR, todayISO } from '@/lib/utils'
import { PAGE_SIZE, pageFromParam, pageRange, sanitizeSearch } from '@/lib/stock'
import { addDaysISO } from '@/lib/quotes'
import {
  ENTRY_STATUS_CHIP,
  ENTRY_STATUS_LABEL,
  KIND_LABEL,
  entryDisplayStatus,
  isValidMonth,
  monthBounds,
  type EntryKind,
} from '@/lib/finance'
import { INPUT_CLASS } from '@/components/form-field'
import { Pagination } from '../pagination'
import { openSummary } from './finance-data'

export const metadata = { title: 'Financeiro' }

const FILTERS = { abertas: 'Em aberto', vencidas: 'Vencidas', pagas: 'Baixadas', canceladas: 'Canceladas', todas: 'Todas' } as const
type Filter = keyof typeof FILTERS

type SearchParams = { tipo?: string; filtro?: string; mes?: string; q?: string; cliente?: string; pagina?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) notFound()
  const params = await searchParams
  const kind: EntryKind = params.tipo === 'pagar' ? 'pagar' : 'receber'
  const filter: Filter = params.filtro && params.filtro in FILTERS ? (params.filtro as Filter) : 'abertas'
  const month = isValidMonth(params.mes) ? params.mes : ''
  const q = sanitizeSearch(params.q)
  const customerId = kind === 'receber' && params.cliente && UUID.test(params.cliente) ? params.cliente : ''
  const page = pageFromParam(params.pagina)
  const { from, to } = pageRange(page)
  const today = todayISO()

  const supabase = await createClient()
  let query = supabase
    .from('financial_entries')
    .select(
      'id, description, category, amount, due_date, status, paid_at, paid_amount, installment, installments, sale_id, customers(name), suppliers(name)',
      { count: 'exact' },
    )
    .eq('organization_id', organization.id)
    .eq('kind', kind)
  if (filter === 'abertas') query = query.eq('status', 'aberto')
  if (filter === 'vencidas') query = query.eq('status', 'aberto').lt('due_date', today)
  if (filter === 'pagas') query = query.eq('status', 'pago')
  if (filter === 'canceladas') query = query.eq('status', 'cancelado')
  if (month) {
    const b = monthBounds(month)
    query = query.gte('due_date', b.start).lte('due_date', b.end)
  }
  if (q) query = query.or(`description.ilike.%${q}%,category.ilike.%${q}%`)
  if (customerId) query = query.eq('customer_id', customerId)
  const ascending = filter === 'abertas' || filter === 'vencidas'

  const [{ data: entries, count, error }, summary] = await Promise.all([
    query.order('due_date', { ascending }).order('created_at').range(from, to),
    openSummary(supabase, organization.id, today, addDaysISO(today, 7)),
  ])

  const tab = (k: EntryKind) =>
    cn(
      'rounded-md px-4 py-2 text-sm',
      k === kind ? 'bg-primary text-primary-foreground font-medium' : 'border hover:bg-accent',
    )
  const card = (k: EntryKind) => summary[k]

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Contas a receber e a pagar. Venda fiado entra aqui sozinha.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/financeiro/fluxo" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Fluxo de caixa
          </Link>
          <Link
            href={`/financeiro/novo?tipo=${kind}`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Nova conta {kind === 'receber' ? 'a receber' : 'a pagar'}
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {(['receber', 'pagar'] as const).map((k) => (
          <Link key={k} href={`/financeiro?tipo=${k}`} className="rounded-lg border bg-card p-5 hover:bg-accent/40">
            <p className="text-xs text-muted-foreground">{KIND_LABEL[k]} (em aberto)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrencyBRL(card(k).open)}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className={card(k).overdue > 0 ? 'text-rose-700 font-medium' : 'text-muted-foreground'}>
                Vencidas: {formatCurrencyBRL(card(k).overdue)}
              </span>
              <span className="text-muted-foreground">Próximos 7 dias: {formatCurrencyBRL(card(k).next7)}</span>
            </div>
          </Link>
        ))}
      </section>

      <div className="flex gap-2">
        <Link href="/financeiro?tipo=receber" className={tab('receber')}>
          A receber
        </Link>
        <Link href="/financeiro?tipo=pagar" className={tab('pagar')}>
          A pagar
        </Link>
      </div>

      <form className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="tipo" value={kind} />
        {customerId ? <input type="hidden" name="cliente" value={customerId} /> : null}
        <input name="q" defaultValue={params.q ?? ''} placeholder="Buscar descrição ou categoria" className={`${INPUT_CLASS} max-w-xs`} />
        <select name="filtro" defaultValue={filter} className={`${INPUT_CLASS} w-auto`}>
          {Object.entries(FILTERS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          Vencimento em
          <input type="month" name="mes" defaultValue={month} className={`${INPUT_CLASS} w-auto`} />
        </label>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
          Filtrar
        </button>
      </form>

      {customerId ? (
        <p className="text-sm text-muted-foreground">
          Mostrando só as contas de um cliente.{' '}
          <Link href="/financeiro?tipo=receber" className="underline underline-offset-4">
            Ver todas
          </Link>
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Não foi possível carregar as contas. Atualize a página.
        </p>
      ) : !entries || entries.length === 0 ? (
        <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Nenhuma conta aqui.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Vencimento</th>
                <th className="px-4 py-2 font-medium">Descrição</th>
                <th className="px-4 py-2 font-medium">{kind === 'receber' ? 'Cliente' : 'Fornecedor'}</th>
                <th className="px-4 py-2 font-medium">Situação</th>
                <th className="px-4 py-2 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const st = entryDisplayStatus(e.status, e.due_date, today)
                return (
                  <tr key={e.id} className="border-t">
                    <td className={cn('px-4 py-3 tabular-nums whitespace-nowrap', st === 'vencido' && 'text-rose-700 font-medium')}>
                      {formatDateBR(e.due_date)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/financeiro/${e.id}`} className="font-medium hover:underline">
                        {e.description}
                      </Link>
                      {e.installments ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          parcela {e.installment}/{e.installments}
                        </span>
                      ) : null}
                      {e.category ? <span className="block text-xs text-muted-foreground">{e.category}</span> : null}
                    </td>
                    <td className="px-4 py-3">{(kind === 'receber' ? e.customers?.name : e.suppliers?.name) ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full border px-2 py-0.5 text-xs', ENTRY_STATUS_CHIP[st])}>
                        {ENTRY_STATUS_LABEL[kind][st]}
                      </span>
                      {e.status === 'pago' && e.paid_at ? (
                        <span className="block text-xs text-muted-foreground">em {formatDateBR(e.paid_at)}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrencyBRL(e.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/financeiro"
        params={{
          tipo: kind,
          filtro: filter === 'abertas' ? undefined : filter,
          mes: month || undefined,
          q: params.q,
          cliente: customerId || undefined,
        }}
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
      />
    </div>
  )
}
