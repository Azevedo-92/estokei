'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Minus, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { INPUT_CLASS } from '@/components/form-field'
import { cn, formatCurrencyBRL } from '@/lib/utils'
import { formatQuantity, parseDecimalBR, toInputBR } from '@/lib/stock'
import { PAYMENT_LABEL, PAYMENT_METHODS, cartTotals, lineTotal, type PaymentMethod } from '@/lib/pos'
import {
  finalizeSaleAction,
  searchCustomersAction,
  searchProductsAction,
  type PosCustomer,
  type PosProduct,
} from './actions'

type Line = { product: PosProduct; quantity: number; quantityText: string }
type Done = { saleId: string; number: number; total: number; change: number | null }

const BTN_PRIMARY =
  'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50'

/** Busca com espera curta entre teclas (o leitor de código de barras digita rápido e manda Enter). */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function Pos({ initialCustomer }: { initialCustomer: PosCustomer | null }) {
  const [lines, setLines] = useState<Line[]>([])
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<PosProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [customer, setCustomer] = useState<PosCustomer | null>(initialCustomer)
  const [customerTerm, setCustomerTerm] = useState('')
  const [customerResults, setCustomerResults] = useState<PosCustomer[]>([])
  const [method, setMethod] = useState<PaymentMethod>('dinheiro')
  const [discountText, setDiscountText] = useState('')
  const [receivedText, setReceivedText] = useState('')
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState<Done | null>(null)
  const [pending, startTransition] = useTransition()
  const searchRef = useRef<HTMLInputElement>(null)

  const debouncedTerm = useDebounced(term, 250)
  const debouncedCustomer = useDebounced(customerTerm, 300)

  useEffect(() => {
    if (!debouncedTerm.trim()) return
    let alive = true
    searchProductsAction(debouncedTerm).then((rows) => {
      if (alive) {
        setResults(rows)
        setSearching(false)
      }
    })
    return () => {
      alive = false
    }
  }, [debouncedTerm])

  useEffect(() => {
    if (!debouncedCustomer.trim()) return
    let alive = true
    searchCustomersAction(debouncedCustomer).then((rows) => {
      if (alive) setCustomerResults(rows)
    })
    return () => {
      alive = false
    }
  }, [debouncedCustomer])

  const discount = parseDecimalBR(discountText) ?? 0
  const received = receivedText.trim() ? parseDecimalBR(receivedText) : null
  const totals = useMemo(
    () =>
      cartTotals(
        lines.map((l) => ({ productId: l.product.id, unitPrice: Number(l.product.sale_price), quantity: l.quantity })),
        discount,
        method,
        received,
      ),
    [lines, discount, method, received],
  )

  function addProduct(p: PosProduct) {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id)
      if (i >= 0) {
        const next = [...prev]
        const q = next[i].quantity + 1
        next[i] = { ...next[i], quantity: q, quantityText: toInputBR(q) }
        return next
      }
      return [...prev, { product: p, quantity: 1, quantityText: '1' }]
    })
    setTerm('')
    setResults([])
    searchRef.current?.focus()
  }

  function onSearchChange(value: string) {
    setTerm(value)
    if (value.trim()) {
      setSearching(true)
    } else {
      setResults([])
      setSearching(false)
    }
  }

  async function onSearchEnter() {
    const q = term.trim()
    if (!q) return
    // Enter (ou o leitor) com um resultado só: entra direto no carrinho.
    const rows = await searchProductsAction(q)
    if (rows.length === 1) addProduct(rows[0])
    else {
      setResults(rows)
      setSearching(false)
      if (rows.length === 0) toast.error('Nenhum produto encontrado.')
    }
  }

  function setQuantity(id: string, text: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.product.id !== id) return l
        const q = parseDecimalBR(text)
        return { ...l, quantityText: text, quantity: q !== null && q > 0 ? q : 0 }
      }),
    )
  }

  function step(id: string, delta: number) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.product.id !== id) return l
        const q = Math.max(1, Math.round((l.quantity + delta) * 1000) / 1000)
        return { ...l, quantity: q, quantityText: toInputBR(q) }
      }),
    )
  }

  function remove(id: string) {
    setLines((prev) => prev.filter((l) => l.product.id !== id))
  }

  function reset() {
    setLines([])
    setCustomer(null)
    setCustomerTerm('')
    setCustomerResults([])
    setMethod('dinheiro')
    setDiscountText('')
    setReceivedText('')
    setNotes('')
    setDone(null)
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  const invalidLine = lines.find((l) => !(l.quantity > 0))
  const overStock = lines.filter((l) => l.quantity > Number(l.product.stock_quantity))
  const missingCash = totals.change !== null && totals.change < 0
  const canFinish =
    lines.length > 0 && !invalidLine && !missingCash && !(method === 'fiado' && !customer) && !pending

  function finish() {
    if (!canFinish) return
    startTransition(async () => {
      const res = await finalizeSaleAction({
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        paymentMethod: method,
        customerId: customer?.id ?? null,
        discount: totals.discount,
        amountReceived: method === 'dinheiro' ? received : null,
        notes,
      })
      if (res.ok) {
        setDone({ saleId: res.saleId, number: res.number, total: res.total, change: res.change })
        toast.success(`Venda #${res.number} concluída.`)
      } else {
        toast.error(res.message)
      }
    })
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-lg border bg-card p-8 text-center space-y-4">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
        <div>
          <h2 className="text-xl font-semibold">Venda #{done.number} concluída</h2>
          <p className="mt-1 text-sm text-muted-foreground">O estoque já foi baixado.</p>
        </div>
        <p className="text-3xl font-semibold tabular-nums">{formatCurrencyBRL(done.total)}</p>
        {done.change !== null && done.change > 0 ? (
          <p className="rounded-md bg-amber-50 border border-amber-200 p-3 text-lg font-medium text-amber-900">
            Troco: {formatCurrencyBRL(done.change)}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button type="button" onClick={reset} className={BTN_PRIMARY} autoFocus>
            Nova venda
          </button>
          <Link href={`/vendas/${done.saleId}?imprimir=1`} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Imprimir cupom
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* Produtos e carrinho */}
      <section className="space-y-4 min-w-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            autoFocus
            value={term}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onSearchEnter()
              }
              if (e.key === 'Escape') onSearchChange('')
            }}
            placeholder="Código de barras, código ou nome do produto"
            className={`${INPUT_CLASS} pl-9 h-11 text-base`}
            aria-label="Buscar produto"
          />
          {term.trim() ? (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg">
              {searching ? (
                <p className="p-3 text-sm text-muted-foreground">Buscando…</p>
              ) : results.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
              ) : (
                <ul className="max-h-80 overflow-y-auto">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addProduct(p)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {p.code}
                            {p.barcode ? ` · ${p.barcode}` : ''} · estoque {formatQuantity(p.stock_quantity)} {p.unit}
                          </span>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">{formatCurrencyBRL(p.sale_price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
            Passe o código de barras no leitor ou busque o produto pelo nome para começar a venda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium text-center">Qtd.</th>
                  <th className="px-3 py-2 font-medium text-right">Preço</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const over = l.quantity > Number(l.product.stock_quantity)
                  return (
                    <tr key={l.product.id} className="border-t align-middle">
                      <td className="px-3 py-2">
                        <span className="block font-medium">{l.product.name}</span>
                        <span className={cn('text-xs tabular-nums', over ? 'text-rose-700' : 'text-muted-foreground')}>
                          {l.product.code} · estoque {formatQuantity(l.product.stock_quantity)} {l.product.unit}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => step(l.product.id, -1)}
                            className="rounded border p-1 hover:bg-accent"
                            aria-label="Diminuir"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            value={l.quantityText}
                            onChange={(e) => setQuantity(l.product.id, e.target.value)}
                            inputMode="decimal"
                            className={cn(
                              'w-16 rounded-md border bg-background px-2 py-1 text-center tabular-nums',
                              !(l.quantity > 0) && 'border-rose-400',
                            )}
                            aria-label={`Quantidade de ${l.product.name}`}
                          />
                          <button
                            type="button"
                            onClick={() => step(l.product.id, 1)}
                            className="rounded border p-1 hover:bg-accent"
                            aria-label="Aumentar"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyBRL(l.product.sale_price)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrencyBRL(lineTotal({ unitPrice: Number(l.product.sale_price), quantity: l.quantity }))}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => remove(l.product.id)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
                          aria-label={`Remover ${l.product.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {overStock.length > 0 ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            Estoque insuficiente para: {overStock.map((l) => l.product.name).join(', ')}. Ajuste a quantidade ou
            dê entrada no estoque antes de finalizar.
          </p>
        ) : null}
      </section>

      {/* Pagamento */}
      <aside className="space-y-4 rounded-lg border bg-card p-5 h-fit lg:sticky lg:top-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">Cliente</p>
          {customer ? (
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{customer.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setCustomer(null)}
                className="rounded p-1 hover:bg-accent"
                aria-label="Tirar cliente"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={customerTerm}
                onChange={(e) => {
                  setCustomerTerm(e.target.value)
                  if (!e.target.value.trim()) setCustomerResults([])
                }}
                placeholder="Opcional: nome, CPF ou telefone"
                className={INPUT_CLASS}
                aria-label="Buscar cliente"
              />
              {customerTerm.trim() ? (
                <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
                  {customerResults.length === 0 ? (
                    <li className="p-3 text-sm text-muted-foreground">
                      Nenhum cliente.{' '}
                      <Link href="/clientes/novo" className="underline" target="_blank">
                        Cadastrar
                      </Link>
                    </li>
                  ) : (
                    customerResults.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomer(c)
                            setCustomerTerm('')
                            setCustomerResults([])
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          <span className="block font-medium">{c.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {[c.document, c.phone].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Pagamento</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn(
                  'rounded-md border px-2 py-2 text-sm',
                  method === m ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-accent',
                )}
                aria-pressed={method === m}
              >
                {PAYMENT_LABEL[m]}
              </button>
            ))}
          </div>
          {method === 'fiado' && !customer ? (
            <p className="text-xs text-rose-700">Venda fiado precisa de um cliente.</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Desconto (R$)</span>
            <input
              value={discountText}
              onChange={(e) => setDiscountText(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className={INPUT_CLASS}
            />
          </label>
          {method === 'dinheiro' ? (
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Recebido (R$)</span>
              <input
                value={receivedText}
                onChange={(e) => setReceivedText(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className={INPUT_CLASS}
              />
            </label>
          ) : null}
        </div>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Observação</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            className={INPUT_CLASS}
          />
        </label>

        <dl className="space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatCurrencyBRL(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Desconto</dt>
              <dd className="tabular-nums">− {formatCurrencyBRL(totals.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between pt-1 text-xl font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatCurrencyBRL(totals.total)}</dd>
          </div>
          {totals.change !== null ? (
            <div className={cn('flex justify-between font-medium', missingCash ? 'text-rose-700' : 'text-emerald-700')}>
              <dt>{missingCash ? 'Falta' : 'Troco'}</dt>
              <dd className="tabular-nums">{formatCurrencyBRL(Math.abs(totals.change))}</dd>
            </div>
          ) : null}
        </dl>

        <button type="button" onClick={finish} disabled={!canFinish} className={`${BTN_PRIMARY} w-full py-3 text-base`}>
          {pending ? 'Finalizando…' : 'Finalizar venda'}
        </button>
        {lines.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              if (confirm('Limpar a venda atual?')) reset()
            }}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Cancelar e limpar
          </button>
        ) : null}
      </aside>
    </div>
  )
}
