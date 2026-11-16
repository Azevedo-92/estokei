import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { cn, dateInSaoPaulo, formatCurrencyBRL, formatDateBR, todayISO } from '@/lib/utils'
import { buildCashFlow, isValidMonth, monthBounds } from '@/lib/finance'
import { fetchAll } from '../finance-data'

export const metadata = { title: 'Fluxo de caixa' }

const MONTH_LABEL = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/**
 * Fluxo de caixa realizado no mês: vendas à vista (todas as formas menos
 * fiado) + contas recebidas − contas pagas. O fiado entra no dia em que é
 * recebido no financeiro, então não conta duas vezes.
 */
export default async function FluxoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { organization, role } = await requireOrganization()
  if (!canManageTeam(role)) notFound()
  const { mes } = await searchParams
  const month = isValidMonth(mes) ? mes : todayISO().slice(0, 7)
  const b = monthBounds(month)
  const supabase = await createClient()

  const [sales, entries, forecast] = await Promise.all([
    fetchAll<{ total: number; created_at: string }>((from, to) =>
      supabase
        .from('sales')
        .select('total, created_at')
        .eq('organization_id', organization.id)
        .eq('status', 'concluida')
        .neq('payment_method', 'fiado')
        .gte('created_at', `${b.start}T00:00:00-03:00`)
        .lte('created_at', `${b.end}T23:59:59.999-03:00`)
        .order('created_at')
        .range(from, to),
    ),
    fetchAll<{ kind: string; paid_at: string | null; paid_amount: number | null }>((from, to) =>
      supabase
        .from('financial_entries')
        .select('kind, paid_at, paid_amount')
        .eq('organization_id', organization.id)
        .eq('status', 'pago')
        .gte('paid_at', b.start)
        .lte('paid_at', b.end)
        .order('paid_at')
        .range(from, to),
    ),
    fetchAll<{ kind: string; amount: number }>((from, to) =>
      supabase
        .from('financial_entries')
        .select('kind, amount')
        .eq('organization_id', organization.id)
        .eq('status', 'aberto')
        .gte('due_date', b.start)
        .lte('due_date', b.end)
        .order('due_date')
        .range(from, to),
    ),
  ])

  const flow = buildCashFlow(
    sales.map((s) => ({ date: dateInSaoPaulo(s.created_at), total: Number(s.total) })),
    entries.filter((e) => e.kind === 'receber').map((e) => ({ date: e.paid_at!, amount: Number(e.paid_amount) })),
    entries.filter((e) => e.kind === 'pagar').map((e) => ({ date: e.paid_at!, amount: Number(e.paid_amount) })),
  )
  const sum = (kind: string) =>
    forecast.filter((f) => f.kind === kind).reduce((a, f) => a + Math.round(Number(f.amount) * 100), 0) / 100
  const toReceive = sum('receber')
  const toPay = sum('pagar')
  const label = MONTH_LABEL.format(new Date(`${month}-01T12:00:00Z`))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/financeiro" className="text-sm text-muted-foreground hover:text-foreground">
          ← Financeiro
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Fluxo de caixa</h1>
          <div className="flex items-center gap-2 text-sm">
            <Link href={`/financeiro/fluxo?mes=${b.prev}`} className="rounded-md border px-3 py-1.5 hover:bg-accent">
              ←
            </Link>
            <span className="min-w-36 text-center font-medium capitalize">{label}</span>
            <Link href={`/financeiro/fluxo?mes=${b.next}`} className="rounded-md border px-3 py-1.5 hover:bg-accent">
              →
            </Link>
          </div>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Vendas à vista</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700">{formatCurrencyBRL(flow.totals.salesIn)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Contas recebidas</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700">{formatCurrencyBRL(flow.totals.received)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Contas pagas</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-rose-700">{formatCurrencyBRL(flow.totals.paid)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Resultado do mês</p>
          <p
            className={cn(
              'mt-1 text-xl font-semibold tabular-nums',
              flow.totals.net < 0 ? 'text-rose-700' : 'text-foreground',
            )}
          >
            {formatCurrencyBRL(flow.totals.net)}
          </p>
        </div>
      </section>

      <p className="rounded-md border bg-muted/30 p-3 text-sm">
        Ainda em aberto com vencimento neste mês: <strong>{formatCurrencyBRL(toReceive)}</strong> a receber e{' '}
        <strong>{formatCurrencyBRL(toPay)}</strong> a pagar.{' '}
        <Link href={`/financeiro?mes=${month}`} className="underline underline-offset-4">
          Ver contas
        </Link>
      </p>

      {flow.days.length === 0 ? (
        <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Nenhuma entrada ou saída neste mês.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Dia</th>
                <th className="px-4 py-2 font-medium text-right">Vendas à vista</th>
                <th className="px-4 py-2 font-medium text-right">Recebido</th>
                <th className="px-4 py-2 font-medium text-right">Pago</th>
                <th className="px-4 py-2 font-medium text-right">Saldo do dia</th>
                <th className="px-4 py-2 font-medium text-right">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {flow.days.map((d) => (
                <tr key={d.date} className="border-t">
                  <td className="px-4 py-2 tabular-nums">{formatDateBR(d.date)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.salesIn ? formatCurrencyBRL(d.salesIn) : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.received ? formatCurrencyBRL(d.received) : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.paid ? formatCurrencyBRL(d.paid) : '—'}</td>
                  <td className={cn('px-4 py-2 text-right tabular-nums', d.net < 0 && 'text-rose-700')}>
                    {formatCurrencyBRL(d.net)}
                  </td>
                  <td className={cn('px-4 py-2 text-right tabular-nums font-medium', d.balance < 0 && 'text-rose-700')}>
                    {formatCurrencyBRL(d.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
