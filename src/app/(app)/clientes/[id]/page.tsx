import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn, formatCurrencyBRL } from '@/lib/utils'
import { paymentLabel } from '@/lib/pos'
import { CustomerForm } from '../customer-form'

export const metadata = { title: 'Cliente' }

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ salvo?: string }>
}) {
  const { organization } = await requireOrganization()
  const { id } = await params
  const sp = await searchParams

  const supabase = await createClient()
  const { data: c } = await supabase
    .from('customers')
    .select('id, name, document, phone, email, address, notes, active')
    .eq('id', id)
    .eq('organization_id', organization.id)
    .maybeSingle()
  if (!c) notFound()

  const { data: sales } = await supabase
    .from('sales')
    .select('id, number, status, total, payment_method, created_at')
    .eq('organization_id', organization.id)
    .eq('customer_id', c.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
        <div className="flex flex-wrap gap-3">
          <Link href={`/orcamentos/novo?cliente=${c.id}`} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Novo orçamento
          </Link>
          <Link
            href={`/pdv?cliente=${c.id}`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Nova venda para este cliente
          </Link>
        </div>
      </header>

      {sp.salvo ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Cliente salvo.</p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-medium">Últimas compras</h2>
        {!sales || sales.length === 0 ? (
          <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Nenhuma compra ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Venda</th>
                  <th className="px-4 py-2 font-medium">Data</th>
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
                    <td className="px-4 py-3 tabular-nums">{DATE_TIME.format(new Date(s.created_at))}</td>
                    <td className="px-4 py-3">{paymentLabel(s.payment_method)}</td>
                    <td className={cn('px-4 py-3 text-right tabular-nums', s.status === 'cancelada' && 'line-through text-muted-foreground')}>
                      {formatCurrencyBRL(s.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <details className="group" open={Boolean(sp.salvo)}>
        <summary className="cursor-pointer text-sm font-medium">Editar cadastro do cliente</summary>
        <div className="mt-4">
          <CustomerForm
            initial={{
              id: c.id,
              name: c.name,
              document: c.document ?? '',
              phone: c.phone ?? '',
              email: c.email ?? '',
              address: c.address ?? '',
              notes: c.notes ?? '',
              active: c.active,
            }}
          />
        </div>
      </details>
    </div>
  )
}
