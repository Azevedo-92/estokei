// Planos do Estokei. Todos têm todos os recursos; muda só o tamanho da
// equipe. No anual o cliente paga 10 mensalidades (2 meses grátis).
// Usado na página de preços, na contratação (Asaas) e no limite de pessoas.

export type PlanSlug = 'essencial' | 'profissional' | 'completo'
export type BillingCycle = 'monthly' | 'yearly'

export type Plan = {
  slug: PlanSlug
  name: string
  /** Máximo de pessoas na equipe (membros + convites pendentes). */
  users: number
  description: string
  /** Mensalidade em reais. */
  monthly: number
  highlight?: boolean
}

// Valores iniciais de lançamento (sem nota fiscal de venda). Revisar quando a
// emissão de NFC-e/NF-e entrar.
export const PLANS: Plan[] = [
  {
    slug: 'essencial',
    name: 'Essencial',
    users: 2,
    description: 'Para a loja pequena: o dono e mais uma pessoa no caixa.',
    monthly: 79,
  },
  {
    slug: 'profissional',
    name: 'Profissional',
    users: 5,
    description: 'Para a loja com caixa, vendedores e alguém no estoque.',
    monthly: 149,
    highlight: true,
  },
  {
    slug: 'completo',
    name: 'Completo',
    users: 15,
    description: 'Para lojas maiores, com vários caixas e equipe de vendas.',
    monthly: 249,
  },
]

export const ANNUAL_MONTHS_CHARGED = 10

export const CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: 'mensal',
  yearly: 'anual',
}

export function getPlan(slug: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.slug === slug)
}

/**
 * Plano e ciclo pré-marcados na tela de pagamento: o que veio na URL
 * (?plano=&ciclo=anual|mensal) ou o que a pessoa clicou antes de se cadastrar
 * (user_metadata.desired_plan/desired_cycle). Padrão: Profissional anual.
 */
export function preselectedPlan(
  query: { plano?: string | string[]; ciclo?: string | string[] },
  metadata: Record<string, unknown> | undefined
): { plan: PlanSlug; cycle: BillingCycle } {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const ciclo = one(query.ciclo)
  const fromQuery: BillingCycle | undefined =
    ciclo === 'anual' ? 'yearly' : ciclo === 'mensal' ? 'monthly' : undefined
  const metaCycle = metadata?.desired_cycle
  return {
    plan:
      getPlan(one(query.plano))?.slug ??
      getPlan(typeof metadata?.desired_plan === 'string' ? metadata.desired_plan : undefined)?.slug ??
      'profissional',
    cycle: fromQuery ?? (metaCycle === 'monthly' || metaCycle === 'yearly' ? metaCycle : 'yearly'),
  }
}

/** Valor de cada cobrança: a mensalidade, ou 10 mensalidades no anual. */
export function planPrice(plan: Plan, cycle: BillingCycle): number {
  return cycle === 'yearly' ? plan.monthly * ANNUAL_MONTHS_CHARGED : plan.monthly
}

/**
 * Mensagem de bloqueio se a equipe já ocupa todas as vagas do plano (membros +
 * convites pendentes); null se ainda cabe mais uma pessoa.
 */
export function seatLimitMessage(plan: Plan, used: number): string | null {
  if (used < plan.users) return null
  return `O plano ${plan.name} permite até ${plan.users} pessoas na equipe, contando os convites pendentes. Para aumentar, fale com a gente pelo Suporte ou WhatsApp.`
}

/** Quanto o anual sai por mês, arredondado (para a vitrine). */
export function annualPerMonth(plan: Plan): number {
  return Math.round((plan.monthly * ANNUAL_MONTHS_CHARGED) / 12)
}
