import Link from 'next/link'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn, formatCurrencyBRL } from '@/lib/utils'
import { PAGE_SIZE, pageFromParam, pageRange } from '@/lib/stock'
import { PAYMENT_LABEL, paymentLabel, type PaymentMethod } from '@/lib/pos'
import { INPUT_CLASS } from '@/components/form-field'
import { Pagination } from '../pagination'
import { salesSummary, startOfDaySP } from './sales-summary'

export const metadata = { title: 'Vendas' }

const PERIODS = { hoje: 'Hoje', '7': 'Últimos 7 dias', '30': 'Últimos 30 dias', todas: 'Todas' } as const
type Period = keyof typeof PERIODS
const PERIOD_DAYS: Record<Period, number | null> = { hoje: 0, '7': 6, '30': 29, todas: null }

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

type SearchParams = { periodo?: string; status?: string; pagina?: string }

export default async function VendasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { organization } = await requireOrganization()
  const params = await searchParams
  const period: Period = params.periodo && params.periodo in PERIODS ? (params.periodo as Period) : 'hoje'
  const status = params.status === 'concluida' || params.status === 'cancelada' ? params.status : ''
  const page = pageFromParam(params.pagina)
  const { from, to } = pageRange(page)
  const days = PERIOD_DAYS[period]
  const since = days === null ? null : startOfDaySP(days)

  const supabase = await createClient()
  let query = supabase
    .from('sales')
    .select('id, number, status, total, payment_method, created_at, customers(name)', { count: 'exact' })
    .eq('organization_id', organization.id)
  if (since) query = query.gte('created_at', since)
  if (status) query = query.eq('status', status)

  const [{ data: sales, count, error }, summary] = await Promise.all([
    query.order('created_at', { ascending: false }).range(from, to),
    since ? salesSummary(supabase, organization.id, since) : Promise.resolve(null),
  ])

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count ?? 0} venda{count === 1 ? '' : 's'} ({PERIODS[period].toLowerCase()}).
          </p>
        </div>
        <Link
          href="/pdv"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Nova venda
        </Link>
      </header>

      {summary ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total vendido</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrencyBRL(summary.total)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Vendas concluídas</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.count}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-sm">
            <p className="text-xs text-muted-foreground mb-1">Por forma de pagamento</p>
            {Object.keys(summary.byMethod).length === 0 ? (
              <p className="text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-0.5">
                {(Object.keys(PAYMENT_LABEL) as PaymentMethod[])
                  .filter((m) => summary.byMethod[m])
                  .map((m) => (
                    <li key={m} className="flex justify-between gap-2">
                      <span>{PAYMENT_LABEL[m]}</span>
                      <span className="tabular-nums">{formatCurrencyBRL(summary.byMethod[m])}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      <form className="flex flex-wrap items-center gap-3">
        <select name="periodo" defaultValue={period} className={`${INPUT_CLASS} w-auto`}>
          {Object.entries(PERIODS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className={`${INPUT_CLASS} w-auto`}>
          <option value="">Todas as situações</option>
          <option value="concluida">Concluídas</option>
          <option value="cancelada">Canceladas</option>
        </select>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
          Filtrar
        </button>
      </form>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Não foi possível carregar as vendas. Atualize a página.
        </p>
      ) : !sales || sales.length === 0 ? (
        <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Nenhuma venda nesse período.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Venda</th>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Pagamento</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link href={`/vendas/${s.id}`} className="font-medium hover:underline">
                      #{s.number}
                    </Link>
                    {s.status === 'cancelada' ? (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        cancelada
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{DATE_TIME.format(new Date(s.created_at))}</td>
                  <td className="px-4 py-3">{s.customers?.name ?? '—'}</td>
                  <td className="px-4 py-3">{paymentLabel(s.payment_method)}</td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right tabular-nums',
                      s.status === 'cancelada' && 'line-through text-muted-foreground',
                    )}
                  >
                    {formatCurrencyBRL(s.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/vendas"
        params={{ periodo: period === 'hoje' ? undefined : period, status: status || undefined }}
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
      />
    </div>
  )
}
