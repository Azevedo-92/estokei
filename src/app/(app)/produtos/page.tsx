import Link from 'next/link'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { formatCurrencyBRL } from '@/lib/utils'
import { PAGE_SIZE, formatQuantity, pageFromParam, pageRange, sanitizeSearch } from '@/lib/stock'
import { INPUT_CLASS } from '@/components/form-field'
import { Pagination } from '../pagination'

export const metadata = { title: 'Produtos' }

type SearchParams = { q?: string; pagina?: string; filtro?: string }
const FILTERS = { ativos: 'Ativos', baixo: 'Estoque baixo', inativos: 'Inativos', todos: 'Todos' } as const
type Filter = keyof typeof FILTERS

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { organization, role } = await requireOrganization()
  const canManage = canManageTeam(role)
  const params = await searchParams
  const q = sanitizeSearch(params.q)
  const filter: Filter = params.filtro && params.filtro in FILTERS ? (params.filtro as Filter) : 'ativos'
  const page = pageFromParam(params.pagina)
  const { from, to } = pageRange(page)

  const supabase = await createClient()
  let query = supabase
    .from('products')
    .select('id, code, name, barcode, unit, sale_price, stock_quantity, min_stock, low_stock, active', {
      count: 'exact',
    })
    .eq('organization_id', organization.id)
  if (filter === 'ativos') query = query.eq('active', true)
  if (filter === 'inativos') query = query.eq('active', false)
  if (filter === 'baixo') query = query.eq('active', true).eq('low_stock', true)
  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,barcode.ilike.%${q}%`)
  const { data: products, count, error } = await query.order('name').range(from, to)

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count ?? 0} produto{count === 1 ? '' : 's'} ({FILTERS[filter].toLowerCase()}).
          </p>
        </div>
        {canManage ? (
          <Link
            href="/produtos/novo"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Novo produto
          </Link>
        ) : null}
      </header>

      <form className="flex flex-wrap items-center gap-3">
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Buscar por nome, código ou código de barras"
          className={`${INPUT_CLASS} max-w-sm`}
        />
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
          Não foi possível carregar os produtos. Atualize a página.
        </p>
      ) : !products || products.length === 0 ? (
        <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          {q || filter !== 'ativos' ? 'Nenhum produto encontrado com esse filtro.' : 'Nenhum produto cadastrado ainda.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Código</th>
                <th className="px-4 py-2 font-medium">Produto</th>
                <th className="px-4 py-2 font-medium">Un.</th>
                <th className="px-4 py-2 font-medium text-right">Preço</th>
                <th className="px-4 py-2 font-medium text-right">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.code}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/produtos/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                    {!p.active ? (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        inativo
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{p.unit}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrencyBRL(p.sale_price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={p.low_stock ? 'font-semibold text-rose-700' : undefined}>
                      {formatQuantity(p.stock_quantity)}
                    </span>
                    {p.low_stock ? (
                      <span className="ml-2 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">
                        baixo
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/produtos"
        params={{ q: params.q, filtro: filter === 'ativos' ? undefined : filter }}
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
      />
    </div>
  )
}
