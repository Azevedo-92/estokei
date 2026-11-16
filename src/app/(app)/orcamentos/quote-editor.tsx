'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Search, Trash2, UserRound, X } from 'lucide-react'
import { INPUT_CLASS } from '@/components/form-field'
import { cn, formatCurrencyBRL } from '@/lib/utils'
import { formatQuantity, parseDecimalBR, toInputBR } from '@/lib/stock'
import { cartTotals, lineTotal } from '@/lib/pos'
import { searchCustomersAction, searchProductsAction, type PosCustomer, type PosProduct } from '../pdv/actions'
import { useDebounced } from '../use-debounced'
import { saveQuoteAction } from './actions'

export type EditorLine = { product: PosProduct; quantity: number }

export type QuoteEditorInitial = {
  id: string | null
  lines: EditorLine[]
  customer: PosCustomer | null
  customerName: string
  validUntil: string
  discount: number
  notes: string
}

type Line = EditorLine & { quantityText: string }

export function QuoteEditor({ initial, minDate, maxDate }: { initial: QuoteEditorInitial; minDate: string; maxDate: string }) {
  const router = useRouter()
  const [lines, setLines] = useState<Line[]>(
    initial.lines.map((l) => ({ ...l, quantityText: toInputBR(l.quantity) })),
  )
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<PosProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [customer, setCustomer] = useState<PosCustomer | null>(initial.customer)
  const [customerName, setCustomerName] = useState(initial.customerName)
  const [customerTerm, setCustomerTerm] = useState('')
  const [customerResults, setCustomerResults] = useState<PosCustomer[]>([])
  const [validUntil, setValidUntil] = useState(initial.validUntil)
  const [discountText, setDiscountText] = useState(initial.discount > 0 ? toInputBR(initial.discount, 2) : '')
  const [notes, setNotes] = useState(initial.notes)
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
  const totals = useMemo(
    () =>
      cartTotals(
        lines.map((l) => ({ productId: l.product.id, unitPrice: Number(l.product.sale_price), quantity: l.quantity })),
        discount,
        'pix',
        null,
      ),
    [lines, discount],
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
    if (value.trim()) setSearching(true)
    else {
      setResults([])
      setSearching(false)
    }
  }

  async function onSearchEnter() {
    const q = term.trim()
    if (!q) return
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

  function move(index: number, delta: number) {
    setLines((prev) => {
      const j = index + delta
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  const invalidLine = lines.some((l) => !(l.quantity > 0))
  const discountTooHigh = discount > totals.subtotal
  const canSave = lines.length > 0 && !invalidLine && !discountTooHigh && Boolean(validUntil) && !pending

  function save() {
    if (!canSave) return
    startTransition(async () => {
      const res = await saveQuoteAction({
        quoteId: initial.id,
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        customerId: customer?.id ?? null,
        customerName: customer ? '' : customerName,
        validUntil,
        discount: totals.discount,
        notes,
      })
      if (res.ok) {
        toast.success('Orçamento salvo.')
        router.push(`/orcamentos/${res.id}`)
      } else {
        toast.error(res.message)
      }
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-4 min-w-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            autoFocus={!initial.id}
            value={term}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onSearchEnter()
              }
              if (e.key === 'Escape') onSearchChange('')
            }}
            placeholder="Adicionar produto: código de barras, código ou nome"
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
                            {p.code} · estoque {formatQuantity(p.stock_quantity)} {p.unit}
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
            Busque os produtos para montar o orçamento.
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
                {lines.map((l, i) => (
                  <tr key={l.product.id} className="border-t align-middle">
                    <td className="px-3 py-2">
                      <span className="block font-medium">{l.product.name}</span>
                      <span
                        className={cn(
                          'text-xs tabular-nums',
                          l.quantity > Number(l.product.stock_quantity) ? 'text-amber-700' : 'text-muted-foreground',
                        )}
                      >
                        {l.product.code} · estoque {formatQuantity(l.product.stock_quantity)} {l.product.unit}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        value={l.quantityText}
                        onChange={(e) => setQuantity(l.product.id, e.target.value)}
                        inputMode="decimal"
                        className={cn(
                          'w-20 rounded-md border bg-background px-2 py-1 text-center tabular-nums',
                          !(l.quantity > 0) && 'border-rose-400',
                        )}
                        aria-label={`Quantidade de ${l.product.name}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyBRL(l.product.sale_price)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatCurrencyBRL(lineTotal({ unitPrice: Number(l.product.sale_price), quantity: l.quantity }))}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <button type="button" onClick={() => move(i, -1)} className="rounded p-1 hover:bg-accent" aria-label="Subir">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} className="rounded p-1 hover:bg-accent" aria-label="Descer">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((x) => x.product.id !== l.product.id))}
                          className="rounded p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
                          aria-label={`Remover ${l.product.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Os preços são os do cadastro no momento de salvar e ficam garantidos até a validade. Estoque em laranja: hoje não
          há o suficiente (o orçamento pode ser salvo; a venda só passa com estoque).
        </p>
      </section>

      <aside className="space-y-4 rounded-lg border bg-card p-5 h-fit lg:sticky lg:top-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">Cliente</p>
          {customer ? (
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{customer.name}</span>
              </span>
              <button type="button" onClick={() => setCustomer(null)} className="rounded p-1 hover:bg-accent" aria-label="Tirar cliente">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <input
                  value={customerTerm}
                  onChange={(e) => {
                    setCustomerTerm(e.target.value)
                    if (!e.target.value.trim()) setCustomerResults([])
                  }}
                  placeholder="Buscar cliente cadastrado"
                  className={INPUT_CLASS}
                  aria-label="Buscar cliente"
                />
                {customerTerm.trim() ? (
                  <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
                    {customerResults.length === 0 ? (
                      <li className="p-3 text-sm text-muted-foreground">Nenhum cliente cadastrado com esse nome.</li>
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
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                maxLength={200}
                placeholder="…ou só o nome, para quem não tem cadastro"
                className={INPUT_CLASS}
                aria-label="Nome do cliente sem cadastro"
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Válido até</span>
            <input
              type="date"
              value={validUntil}
              min={minDate}
              max={maxDate}
              onChange={(e) => setValidUntil(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Desconto (R$)</span>
            <input
              value={discountText}
              onChange={(e) => setDiscountText(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className={cn(INPUT_CLASS, discountTooHigh && 'border-rose-400')}
            />
          </label>
        </div>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Observações</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Prazo de entrega, condições de pagamento…"
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
        </dl>
        {discountTooHigh ? <p className="text-xs text-rose-700">O desconto passa do subtotal.</p> : null}

        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="w-full rounded-md bg-primary px-4 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? 'Salvando…' : initial.id ? 'Salvar alterações' : 'Salvar orçamento'}
        </button>
        <Link
          href={initial.id ? `/orcamentos/${initial.id}` : '/orcamentos'}
          className="block text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </Link>
      </aside>
    </div>
  )
}
