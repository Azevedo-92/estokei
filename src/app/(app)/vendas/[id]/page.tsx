import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { formatCurrencyBRL } from '@/lib/utils'
import { formatQuantity } from '@/lib/stock'
import { paymentLabel } from '@/lib/pos'
import { CancelSaleForm } from './cancel-form'
import { PrintButton } from './print-button'

export const metadata = { title: 'Venda' }

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

export default async function VendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ imprimir?: string }>
}) {
  const { organization, role } = await requireOrganization()
  const { id } = await params
  const sp = await searchParams

  const supabase = await createClient()
  const { data: sale } = await supabase
    .from('sales')
    .select(
      'id, number, status, subtotal, discount, total, payment_method, amount_received, change_amount, notes, created_at, created_by, canceled_at, cancel_reason, customers(id, name, document, phone)',
    )
    .eq('id', id)
    .eq('organization_id', organization.id)
    .maybeSingle()
  if (!sale) notFound()

  const [{ data: items }, { data: seller }] = await Promise.all([
    supabase
      .from('sale_items')
      .select('id, product_id, product_code, product_name, unit, quantity, unit_price, total')
      .eq('sale_id', sale.id)
      .eq('organization_id', organization.id)
      .order('product_name'),
    sale.created_by
      ? supabase.from('profiles').select('full_name, email').eq('user_id', sale.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const canceled = sale.status === 'cancelada'
  const sellerName = seller?.full_name || seller?.email || null

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href="/vendas" className="text-sm text-muted-foreground hover:text-foreground">
            ← Vendas
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Venda #{sale.number}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <PrintButton auto={sp.imprimir === '1' && !canceled} />
          <Link href="/pdv" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Nova venda
          </Link>
        </div>
      </div>

      {canceled ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 print:hidden">
          Venda cancelada em {DATE_TIME.format(new Date(sale.canceled_at!))}. Motivo: {sale.cancel_reason}
        </p>
      ) : null}

      {/* Cupom (não fiscal): é o que sai na impressão. */}
      <article className="mx-auto w-full max-w-sm rounded-lg border bg-white p-6 font-mono text-[13px] leading-relaxed text-black print:max-w-none print:border-0 print:p-0">
        <header className="text-center">
          <p className="text-base font-bold">{organization.name}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide">Cupom não fiscal</p>
          <p className="mt-2">
            Venda #{sale.number} · {DATE_TIME.format(new Date(sale.created_at))}
          </p>
          {canceled ? <p className="mt-1 font-bold">*** VENDA CANCELADA ***</p> : null}
        </header>

        <hr className="my-3 border-dashed border-black/40" />

        <ul className="space-y-2">
          {(items ?? []).map((it) => (
            <li key={it.id}>
              <p>
                {it.product_code} {it.product_name}
              </p>
              <p className="flex justify-between">
                <span>
                  {formatQuantity(it.quantity)} {it.unit} × {formatCurrencyBRL(it.unit_price)}
                </span>
                <span>{formatCurrencyBRL(it.total)}</span>
              </p>
            </li>
          ))}
        </ul>

        <hr className="my-3 border-dashed border-black/40" />

        <dl className="space-y-0.5">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatCurrencyBRL(sale.subtotal)}</dd>
          </div>
          {Number(sale.discount) > 0 ? (
            <div className="flex justify-between">
              <dt>Desconto</dt>
              <dd>− {formatCurrencyBRL(sale.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-bold">
            <dt>TOTAL</dt>
            <dd>{formatCurrencyBRL(sale.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Pagamento</dt>
            <dd>{paymentLabel(sale.payment_method)}</dd>
          </div>
          {sale.amount_received !== null ? (
            <>
              <div className="flex justify-between">
                <dt>Recebido</dt>
                <dd>{formatCurrencyBRL(sale.amount_received)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Troco</dt>
                <dd>{formatCurrencyBRL(sale.change_amount ?? 0)}</dd>
              </div>
            </>
          ) : null}
        </dl>

        {sale.customers || sellerName || sale.notes ? <hr className="my-3 border-dashed border-black/40" /> : null}
        {sale.customers ? (
          <p>
            Cliente: {sale.customers.name}
            {sale.customers.document ? ` · ${sale.customers.document}` : ''}
          </p>
        ) : null}
        {sellerName ? <p>Atendido por: {sellerName}</p> : null}
        {sale.notes ? <p>Obs.: {sale.notes}</p> : null}

        <p className="mt-4 text-center text-[11px]">Obrigado pela preferência!</p>
      </article>

      <div className="space-y-4 print:hidden">
        {sale.customers ? (
          <p className="text-sm">
            Cliente:{' '}
            <Link href={`/clientes/${sale.customers.id}`} className="font-medium underline underline-offset-4">
              {sale.customers.name}
            </Link>
          </p>
        ) : null}
        {!canceled && canManageTeam(role) ? <CancelSaleForm saleId={sale.id} /> : null}
      </div>
    </div>
  )
}
