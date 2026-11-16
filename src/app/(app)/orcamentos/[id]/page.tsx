import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Download, MessageCircle, Pencil } from 'lucide-react'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn, formatCurrencyBRL, formatDateBR, todayISO } from '@/lib/utils'
import { formatQuantity } from '@/lib/stock'
import {
  QUOTE_STATUS_CHIP,
  QUOTE_STATUS_LABEL,
  quoteDisplayStatus,
  quoteWhatsappText,
  whatsappNumber,
} from '@/lib/quotes'
import { loadQuote } from '../load-quote'
import { CancelQuoteButton, ConvertQuoteForm } from './quote-actions'

export const metadata = { title: 'Orçamento' }

export default async function OrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { organization } = await requireOrganization()
  const { id } = await params
  const supabase = await createClient()
  const quote = await loadQuote(supabase, organization.id, id)
  if (!quote) notFound()

  const today = todayISO()
  const st = quoteDisplayStatus(quote.status, quote.valid_until, today)
  const customerName = quote.customers?.name ?? quote.customer_name ?? null
  const phone = whatsappNumber(quote.customers?.phone)
  const text = quoteWhatsappText({
    number: quote.number,
    storeName: organization.name,
    customerName,
    validUntilBR: formatDateBR(quote.valid_until),
    items: quote.items.map((i) => ({
      name: i.product_name,
      quantity: Number(i.quantity),
      unit: i.unit,
      total: Number(i.total),
    })),
    discount: Number(quote.discount),
    total: Number(quote.total),
  })
  const waLink = `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(text)}`

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/orcamentos" className="text-sm text-muted-foreground hover:text-foreground">
          ← Orçamentos
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Orçamento #{quote.number}</h1>
          <span className={cn('rounded-full border px-2 py-0.5 text-xs', QUOTE_STATUS_CHIP[st])}>
            {QUOTE_STATUS_LABEL[st]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Criado em {formatDateBR(quote.created_at)}
          {quote.authorName ? ` por ${quote.authorName}` : ''} · válido até {formatDateBR(quote.valid_until)}
        </p>
      </div>

      {quote.sale ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Virou a{' '}
          <Link href={`/vendas/${quote.sale.id}`} className="font-medium underline">
            venda #{quote.sale.number}
          </Link>
          .
        </p>
      ) : null}
      {st === 'vencido' ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Orçamento vencido. Para vender, edite e salve de novo: os preços são atualizados e a validade renovada.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <a
          href={`/orcamentos/${quote.id}/pdf`}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          <Download className="h-4 w-4" aria-hidden /> Baixar PDF
        </a>
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          <MessageCircle className="h-4 w-4" aria-hidden /> Enviar no WhatsApp
        </a>
        {quote.status === 'aberto' ? (
          <Link
            href={`/orcamentos/${quote.id}/editar`}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            <Pencil className="h-4 w-4" aria-hidden /> Editar
          </Link>
        ) : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 text-sm">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Cliente</p>
          {quote.customers ? (
            <Link href={`/clientes/${quote.customers.id}`} className="font-medium hover:underline">
              {quote.customers.name}
            </Link>
          ) : (
            <p className="font-medium">{customerName ?? '—'}</p>
          )}
          {quote.customers?.phone ? <p className="text-muted-foreground">{quote.customers.phone}</p> : null}
        </div>
        {quote.notes ? (
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Observações</p>
            <p className="whitespace-pre-line">{quote.notes}</p>
          </div>
        ) : null}
      </section>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Produto</th>
              <th className="px-4 py-2 font-medium text-right">Qtd.</th>
              <th className="px-4 py-2 font-medium text-right">Preço</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{i.product_code}</td>
                <td className="px-4 py-3">{i.product_name}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatQuantity(i.quantity)} {i.unit}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrencyBRL(i.unit_price)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrencyBRL(i.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t text-sm">
            {Number(quote.discount) > 0 ? (
              <>
                <tr>
                  <td colSpan={4} className="px-4 py-1.5 text-right text-muted-foreground">Subtotal</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatCurrencyBRL(quote.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-4 py-1.5 text-right text-muted-foreground">Desconto</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">− {formatCurrencyBRL(quote.discount)}</td>
                </tr>
              </>
            ) : null}
            <tr className="text-base font-semibold">
              <td colSpan={4} className="px-4 py-2 text-right">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCurrencyBRL(quote.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {st === 'aberto' ? (
        <div className="flex flex-wrap items-start gap-3">
          <ConvertQuoteForm quoteId={quote.id} hasCustomer={Boolean(quote.customers)} />
          <CancelQuoteButton quoteId={quote.id} />
        </div>
      ) : st === 'vencido' ? (
        <CancelQuoteButton quoteId={quote.id} />
      ) : null}
    </div>
  )
}
