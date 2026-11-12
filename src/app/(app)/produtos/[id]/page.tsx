import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { cn, formatCurrencyBRL } from '@/lib/utils'
import { formatQuantity, movementChip, movementLabel, toInputBR } from '@/lib/stock'
import { ProductForm } from '../product-form'
import { MovementForm } from '../movement-form'

export const metadata = { title: 'Produto' }

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

export default async function ProdutoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ salvo?: string; aviso?: string }>
}) {
  const { organization, role } = await requireOrganization()
  const canManage = canManageTeam(role)
  const { id } = await params
  const sp = await searchParams

  const supabase = await createClient()
  const { data: p } = await supabase
    .from('products')
    .select(
      'id, code, name, barcode, unit, cost_price, sale_price, stock_quantity, min_stock, low_stock, supplier_id, active',
    )
    .eq('id', id)
    .eq('organization_id', organization.id)
    .maybeSingle()
  if (!p) notFound()

  const [{ data: suppliers }, { data: movements }] = await Promise.all([
    canManage
      ? supabase
          .from('suppliers')
          .select('id, name')
          .eq('organization_id', organization.id)
          .or(`active.eq.true${p.supplier_id ? `,id.eq.${p.supplier_id}` : ''}`)
          .order('name')
          .limit(1000)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase
      .from('stock_movements')
      .select('id, kind, quantity_delta, balance_after, unit_cost, reference, notes, created_at, suppliers(name)')
      .eq('organization_id', organization.id)
      .eq('product_id', p.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground tabular-nums">{p.code}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 text-right">
          <p className="text-xs text-muted-foreground">Saldo em estoque</p>
          <p className={cn('text-2xl font-semibold tabular-nums', p.low_stock && 'text-rose-700')}>
            {formatQuantity(p.stock_quantity)} <span className="text-sm font-normal">{p.unit}</span>
          </p>
          {p.low_stock ? (
            <p className="text-xs text-rose-700">Abaixo do mínimo ({formatQuantity(p.min_stock)})</p>
          ) : null}
        </div>
      </header>

      {sp.salvo ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Produto salvo.</p>
      ) : null}
      {sp.aviso === 'estoque-inicial' ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          O produto foi cadastrado, mas o estoque inicial não entrou. Lance-o abaixo como uma entrada.
        </p>
      ) : null}

      {canManage ? (
        <>
          <MovementForm
            productId={p.id}
            unit={p.unit}
            suppliers={suppliers ?? []}
            defaultSupplierId={p.supplier_id ?? ''}
          />
          <details className="group" open={Boolean(sp.salvo)}>
            <summary className="cursor-pointer text-sm font-medium">Editar cadastro do produto</summary>
            <div className="mt-4">
              <ProductForm
                suppliers={suppliers ?? []}
                initial={{
                  id: p.id,
                  code: p.code,
                  name: p.name,
                  barcode: p.barcode ?? '',
                  unit: p.unit,
                  cost_price: toInputBR(p.cost_price, 2),
                  sale_price: toInputBR(p.sale_price, 2),
                  min_stock: toInputBR(p.min_stock),
                  supplier_id: p.supplier_id ?? '',
                  active: p.active,
                }}
              />
            </div>
          </details>
        </>
      ) : (
        <section className="rounded-lg border bg-card p-6 grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Preço de venda</p>
            <p className="font-medium">{formatCurrencyBRL(p.sale_price)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Código de barras</p>
            <p className="font-medium tabular-nums">{p.barcode ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estoque mínimo</p>
            <p className="font-medium">{formatQuantity(p.min_stock) || '—'}</p>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Últimas movimentações</h2>
          <Link href={`/estoque?produto=${p.id}`} className="text-sm underline underline-offset-4">
            Ver todas
          </Link>
        </div>
        {!movements || movements.length === 0 ? (
          <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Data</th>
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
                      <span className={cn('rounded-full border px-2 py-0.5 text-xs', movementChip(m.kind))}>
                        {movementLabel(m.kind)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(m.quantity_delta) > 0 ? '+' : ''}
                      {formatQuantity(m.quantity_delta)}
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
      </section>
    </div>
  )
}
