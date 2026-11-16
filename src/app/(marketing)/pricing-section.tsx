'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, MessageCircle, Users } from 'lucide-react'
import { ANNUAL_MONTHS_CHARGED, PLANS, annualPerMonth, type Plan } from '@/lib/plans'
import { planWhatsappLink } from '@/lib/sales'

// Planos e preços em src/lib/plans.ts. Sem teste grátis: "Contratar" leva ao
// cadastro com o plano escolhido e o pagamento é feito dentro do sistema; o
// WhatsApp (src/lib/sales.ts) fica como opção para quem quer conversar antes.

const INCLUDED = [
  'Produtos e clientes ilimitados',
  'PDV para venda no balcão',
  'Controle de estoque com aviso de estoque mínimo',
  'Orçamentos em PDF com a sua marca',
  'Contas a pagar e a receber',
  'Permissões por perfil: dono, caixa e vendedor',
  'Sua marca: logo e cor da loja',
]

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  })
}

export function PricingSection() {
  const [annual, setAnnual] = useState(true)

  return (
    <section id="precos" className="mx-auto max-w-6xl px-6 py-20 md:py-24">
      <div className="text-center max-w-2xl mx-auto">
        <div
          className="text-xs font-medium tracking-wide uppercase"
          style={{ color: 'var(--brand)' }}
        >
          Preços
        </div>
        <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
          Simples, sem pegadinha.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Escolha o plano pelo tamanho da equipe — todos têm os mesmos recursos. Crie sua
          conta e pague por Pix, boleto ou cartão: depois da confirmação, liberamos o acesso
          da sua equipe.
        </p>

        <BillingToggle annual={annual} onChange={setAnnual} />
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
        {PLANS.map((plan) => (
          <PriceCard key={plan.slug} plan={plan} annual={annual} />
        ))}
      </div>

      <div className="mt-10 max-w-5xl mx-auto rounded-2xl border bg-card/50 p-7">
        <h3 className="text-sm font-semibold">Todos os planos incluem</h3>
        <ul className="mt-4 grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {INCLUDED.map((f) => (
            <li key={f} className="flex items-start gap-2 text-muted-foreground">
              <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Preços em reais (BRL), sem taxa de implantação e sem fidelidade. Cancelamento a
        qualquer momento — se anual, reembolso proporcional aos meses não usados.
      </p>
    </section>
  )
}

function BillingToggle({
  annual,
  onChange,
}: {
  annual: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="mt-8 inline-flex items-center rounded-full border bg-muted/30 p-1">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-4 py-1.5 text-sm rounded-full transition ${
          !annual ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
        }`}
      >
        Mensal
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-4 py-1.5 text-sm rounded-full transition inline-flex items-center gap-2 ${
          annual ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
        }`}
      >
        Anual
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
          style={{ background: 'var(--brand-accent, #10b981)' }}
        >
          -17%
        </span>
      </button>
    </div>
  )
}

/**
 * "Contratar" leva ao cadastro já com o plano escolhido (a escolha fica na conta
 * e aparece marcada na tela de pagamento); o WhatsApp fica como opção para quem
 * quer conversar antes.
 */
function ContractButton({
  plan,
  annual,
  primary,
}: {
  plan: Plan
  annual: boolean | null
  primary: boolean
}) {
  const params = new URLSearchParams({ plano: plan.slug })
  if (annual !== null) params.set('ciclo', annual ? 'anual' : 'mensal')
  return (
    <div className="space-y-2">
      <Link
        href={`/cadastrar?${params}`}
        className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
          primary ? 'text-white shadow-sm hover:opacity-90' : 'border hover:bg-accent'
        }`}
        style={primary ? { background: 'var(--brand)' } : undefined}
      >
        Contratar
      </Link>
      <a
        href={planWhatsappLink(plan, annual)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        Prefere conversar? Fale no WhatsApp
      </a>
    </div>
  )
}

function PriceCard({ plan, annual }: { plan: Plan; annual: boolean }) {
  const annualTotal = plan.monthly * ANNUAL_MONTHS_CHARGED
  const price = formatBRL(annual ? annualPerMonth(plan) : plan.monthly)
  const priceSub = annual
    ? `por mês · cobrado ${formatBRL(annualTotal)}/ano`
    : 'por mês · cobrado mensalmente'

  return (
    <div
      className={`rounded-2xl border p-7 flex flex-col ${
        plan.highlight
          ? 'bg-card shadow-lg ring-1 ring-primary/20 relative'
          : 'bg-card/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2 min-h-[22px]">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {plan.highlight ? (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
            style={{ background: 'var(--brand)' }}
          >
            Recomendado
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground min-h-[40px]">{plan.description}</p>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-muted-foreground">/mês</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{priceSub}</p>

      <div className="mt-5 flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4 text-muted-foreground" />
        Até {plan.users} pessoas na equipe
      </div>

      <div className="mt-auto pt-6">
        <ContractButton plan={plan} annual={annual} primary={!!plan.highlight} />
      </div>
    </div>
  )
}

/** Os 3 planos em versão resumida, para fechar a página com a decisão. */
export function CompactPlans() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {PLANS.map((plan) => (
        <div
          key={plan.slug}
          className={`rounded-xl border p-5 text-left flex flex-col gap-3 ${
            plan.highlight ? 'bg-card shadow-md ring-1 ring-primary/20' : 'bg-card/60'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{plan.name}</h3>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" aria-hidden />
                até {plan.users}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-semibold tracking-tight">
                {formatBRL(plan.monthly)}
              </span>
              <span className="text-sm text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground">
              ou {formatBRL(annualPerMonth(plan))}/mês no plano anual
            </p>
          </div>
          <div className="mt-auto">
            <ContractButton plan={plan} annual={null} primary={!!plan.highlight} />
          </div>
        </div>
      ))}
    </div>
  )
}
