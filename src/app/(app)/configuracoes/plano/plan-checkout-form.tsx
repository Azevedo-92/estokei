'use client'

import { useActionState, useEffect, useState } from 'react'
import { Check, ExternalLink, Loader2 } from 'lucide-react'
import { cn, formatCurrencyBRL } from '@/lib/utils'
import { CYCLE_LABEL, PLANS, planPrice, type BillingCycle, type PlanSlug } from '@/lib/plans'
import { startSubscriptionAction, type CheckoutState } from './actions'

const initial: CheckoutState = { ok: false }

/**
 * Escolha do plano + dados para a nota fiscal. Ao confirmar, a assinatura é
 * criada no Asaas e a pessoa vai para a página de pagamento (Pix, boleto ou cartão).
 */
export function PlanCheckoutForm({
  defaultName,
  defaultEmail,
  defaultPlan = 'profissional',
  defaultCycle = 'yearly',
  submitLabel = 'Ir para o pagamento',
}: {
  defaultName: string
  defaultEmail: string
  defaultPlan?: PlanSlug
  defaultCycle?: BillingCycle
  submitLabel?: string
}) {
  const [state, formAction, pending] = useActionState(startSubscriptionAction, initial)
  const [plan, setPlan] = useState<PlanSlug>(defaultPlan)
  const [cycle, setCycle] = useState<BillingCycle>(defaultCycle)

  useEffect(() => {
    if (state.ok && state.invoiceUrl) window.location.assign(state.invoiceUrl)
  }, [state])

  const err = (field: string) => state.fieldErrors?.[field]?.[0]

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="cycle" value={cycle} />

      <div className="inline-flex rounded-lg border bg-muted/40 p-1 text-sm">
        {(['yearly', 'monthly'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCycle(c)}
            className={cn(
              'rounded-md px-3 py-1.5 font-medium capitalize',
              cycle === c ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {CYCLE_LABEL[c]}
            {c === 'yearly' ? <span className="ml-1 text-xs text-emerald-700">2 meses grátis</span> : null}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PLANS.map((p) => {
          const selected = plan === p.slug
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() => setPlan(p.slug)}
              aria-pressed={selected}
              className={cn(
                'rounded-lg border p-4 text-left transition-colors',
                selected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'hover:bg-muted/40'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{p.name}</span>
                {selected ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Até {p.users} pessoas</div>
              <div className="mt-3 text-lg font-semibold tabular-nums">
                {formatCurrencyBRL(planPrice(p, cycle))}
                <span className="text-xs font-normal text-muted-foreground">
                  {cycle === 'yearly' ? '/ano' : '/mês'}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Dados para a cobrança e a nota fiscal</p>
        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">Nome ou razão social</span>
          <input
            name="billingName"
            defaultValue={defaultName}
            required
            maxLength={200}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          {err('billingName') ? <span className="text-xs text-rose-600">{err('billingName')}</span> : null}
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">CPF ou CNPJ</span>
          <input
            name="billingDocument"
            required
            inputMode="text"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            maxLength={20}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          {err('billingDocument') ? (
            <span className="text-xs text-rose-600">{err('billingDocument')}</span>
          ) : null}
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">E-mail para receber as cobranças</span>
          <input
            name="billingEmail"
            type="email"
            defaultValue={defaultEmail}
            required
            maxLength={200}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          {err('billingEmail') ? <span className="text-xs text-rose-600">{err('billingEmail')}</span> : null}
        </label>
      </div>

      {state.message && !state.ok ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {state.message}
        </p>
      ) : null}

      {state.ok && state.invoiceUrl ? (
        <a
          href={state.invoiceUrl}
          className="inline-flex items-center gap-2 text-sm font-medium underline"
        >
          Abrindo a página de pagamento… se não abrir, clique aqui
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {submitLabel}
        </button>
      )}
      <p className="text-xs text-muted-foreground">
        Você vai para a página de pagamento do Asaas e escolhe Pix, boleto ou cartão. A assinatura
        se renova sozinha a cada período e pode ser cancelada quando quiser.
      </p>
    </form>
  )
}
