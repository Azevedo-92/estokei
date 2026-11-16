import Link from 'next/link'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn, formatCurrencyBRL, formatDateBR, todayISO } from '@/lib/utils'
import { PAGE_SIZE, pageFromParam, pageRange } from '@/lib/stock'
import { QUOTE_STATUS_CHIP, QUOTE_STATUS_LABEL, quoteDisplayStatus } from '@/lib/quotes'
import { INPUT_CLASS } from '@/components/form-field'
import { Pagination } from '../pagination'

export const metadata = { title: 'Orçamentos' }

const FILTERS = {
  abertos: 'Em aberto',
  vencidos: 'Vencidos',
  convertidos: 'Viraram venda',
  cancelados: 'Cancelados',
  todos: 'Todos',
} as const
type Filter = keyof typeof FILTERS

type SearchParams = { filtro?: string; pagina?: string }

export default async function OrcamentosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { organization } = await requireOrganization()
  const params = await searchParams
  const filter: Filter = params.filtro && params.filtro in FILTERS ? (params.filtro as Filter) : 'abertos'
  const page = pageFromParam(params.pagina)
  const { from, to } = pageRange(page)
  const today = todayISO()

  const supabase = await createClient()
  let query = supabase
    .from('quotes')
    .select('id, number, status, valid_until, total, created_at, customer_name, customers(name)', { count: 'exact' })
    .eq('organization_id', organization.id)
  if (filter === 'abertos') query = query.eq('status', 'aberto').gte('valid_until', today)
  if (filter === 'vencidos') query = query.eq('status', 'aberto').lt('valid_until', today)
  if (filter === 'convertidos') query = query.eq('status', 'convertido')
  if (filter === 'cancelados') query = query.eq('status', 'cancelado')
  const { data: quotes, count, error } = await query.order('created_at', { ascending: false }).range(from, to)

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orçamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count ?? 0} orçamento{count === 1 ? '' : 's'} ({FILTERS[filter].toLowerCase()}).
          </p>
        </div>
        <Link
          href="/orcamentos/novo"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Novo orçamento
        </Link>
      </header>

      <form className="flex flex-wrap items-center gap-3">
        <select name="filtro" defaultValue={filter} className={`${INPUT_CLASS} w-auto`}>
          {Object.entries(FILTERS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
          Filtrar
        </button>
      </form>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Não foi possível carregar os orçamentos. Atualize a página.
        </p>
      ) : !quotes || quotes.length === 0 ? (
        <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Nenhum orçamento aqui.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Orçamento</th>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Criado em</th>
                <th className="px-4 py-2 font-medium">Validade</th>
                <th className="px-4 py-2 font-medium">Situação</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const st = quoteDisplayStatus(q.status, q.valid_until, today)
                return (
                  <tr key={q.id} className="border-t">
                    <td className="px-4 py-3">
                      <Link href={`/orcamentos/${q.id}`} className="font-medium hover:underline">
                        #{q.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{q.customers?.name ?? q.customer_name ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums">{formatDateBR(q.created_at)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatDateBR(q.valid_until)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full border px-2 py-0.5 text-xs', QUOTE_STATUS_CHIP[st])}>
                        {QUOTE_STATUS_LABEL[st]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrencyBRL(q.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/orcamentos"
        params={{ filtro: filter === 'abertos' ? undefined : filter }}
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
      />
    </div>
  )
}
