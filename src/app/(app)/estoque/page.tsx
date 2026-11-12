import Link from 'next/link'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn, formatCurrencyBRL } from '@/lib/utils'
import { MOVEMENT_LABEL, PAGE_SIZE, formatQuantity, movementChip, movementLabel, pageFromParam, pageRange } from '@/lib/stock'
import { INPUT_CLASS } from '@/components/form-field'
import { Pagination } from '../pagination'

export const metadata = { title: 'Estoque' }

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SearchParams = { tipo?: string; produto?: string; pagina?: string }

export default async function EstoquePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { organization } = await requireOrganization()
  const params = await searchParams
  const kind = params.tipo && params.tipo in MOVEMENT_LABEL ? params.tipo : ''
  const productId = params.produto && UUID.test(params.produto) ? params.produto : ''
  const page = pageFromParam(params.pagina)
  const { from, to } = pageRange(page)

  const supabase = await createClient()
  let movementsQuery = supabase
    .from('stock_movements')
    .select(
      'id, kind, quantity_delta, balance_after, unit_cost, reference, notes, created_at, products(id, code, name, unit), suppliers(name)',
      { count: 'exact' },
    )
    .eq('organization_id', organization.id)
  if (kind) movementsQuery = movementsQuery.eq('kind', kind)
  if (productId) movementsQuery = movementsQuery.eq('product_id', productId)

  const [{ data: movements, count, error }, { data: low, count: lowCount }, { data: filteredProduct }] =
    await Promise.all([
      movementsQuery.order('created_at', { ascending: false }).range(from, to),
      supabase
        .from('products')
        .select('id, code, name, unit, stock_quantity, min_stock', { count: 'exact' })
        .eq('organization_id', organization.id)
        .eq('active', true)
        .eq('low_stock', true)
        .order('name')
        .limit(10),
      productId
        ? supabase.from('products').select('name').eq('id', productId).eq('organization_id', organization.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Estoque</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Histórico de entradas, perdas e ajustes. Para movimentar, abra o produto.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">
            Estoque baixo{lowCount ? <span className="text-muted-foreground font-normal"> ({lowCount})</span> : null}
          </h2>
          {lowCount && lowCount > (low?.length ?? 0) ? (
            <Link href="/produtos?filtro=baixo" className="text-sm underline underline-offset-4">
              Ver todos
            </Link>
          ) : null}
        </div>
        {!low || low.length === 0 ? (
          <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
            Nenhum produto abaixo do estoque mínimo.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {low.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/produtos/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm hover:bg-rose-50"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground tabular-nums">{p.code}</span> {p.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-rose-700">
                    {formatQuantity(p.stock_quantity)} / mín. {formatQuantity(p.min_stock)} {p.unit}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Movimentações</h2>
        <form className="flex flex-wrap items-center gap-3">
          {productId ? <input type="hidden" name="produto" value={productId} /> : null}
          <select name="tipo" defaultValue={kind} className={`${INPUT_CLASS} w-auto`}>
            <option value="">Todos os tipos</option>
            {Object.entries(MOVEMENT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
            Filtrar
          </button>
          {productId ? (
            <span className="text-sm text-muted-foreground">
              Produto: <strong>{filteredProduct?.name ?? '—'}</strong>{' '}
              <Link href={kind ? `/estoque?tipo=${kind}` : '/estoque'} className="underline underline-offset-4">
                limpar
              </Link>
            </span>
          ) : null}
        </form>

        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            Não foi possível carregar as movimentações. Atualize a página.
          </p>
        ) : !movements || movements.length === 0 ? (
          <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Nenhuma movimentação encontrada.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Data</th>
                  <th className="px-4 py-2 font-medium">Produto</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium text-right">Qtd.</th>
                  <th className="px-4 py-2 font-medium text-right">Saldo</th>
                  <th className="px-4 py-2 font-medium">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">{DATE_TIME.format(new Date(m.created_at))}</td>
                    <td className="px-4 py-3">
                      {m.products ? (
                        <Link href={`/produtos/${m.products.id}`} className="hover:underline">
                          <span className="text-muted-foreground tabular-nums">{m.products.code}</span> {m.products.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full border px-2 py-0.5 text-xs', movementChip(m.kind))}>
                        {movementLabel(m.kind)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(m.quantity_delta) > 0 ? '+' : ''}
                      {formatQuantity(m.quantity_delta)} {m.products?.unit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatQuantity(m.balance_after)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[
                        m.suppliers?.name,
                        m.reference ? `NF ${m.reference}` : null,
                        m.unit_cost !== null ? `custo ${formatCurrencyBRL(m.unit_cost)}` : null,
                        m.notes,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          basePath="/estoque"
          params={{ tipo: kind || undefined, produto: productId || undefined }}
          page={page}
          pageSize={PAGE_SIZE}
          total={count ?? 0}
        />
      </section>
    </div>
  )
}
