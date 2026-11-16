import type { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/utils'

/** Início do dia (calendário de Brasília) de N dias atrás, em ISO com fuso. */
export function startOfDaySP(daysAgo = 0): string {
  return `${todayISO(-daysAgo)}T00:00:00-03:00`
}

export type SalesSummary = { count: number; total: number; byMethod: Record<string, number> }

/**
 * Soma das vendas concluídas desde `since`. Lê em páginas de 1.000 (limite do
 * Supabase) até 20 mil vendas no período.
 */
export async function salesSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  since: string,
): Promise<SalesSummary> {
  const summary: SalesSummary = { count: 0, total: 0, byMethod: {} }
  let totalCents = 0
  const byMethodCents: Record<string, number> = {}
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from('sales')
      .select('total, payment_method')
      .eq('organization_id', organizationId)
      .eq('status', 'concluida')
      .gte('created_at', since)
      .order('created_at')
      .range(page * 1000, page * 1000 + 999)
    if (error || !data) break
    for (const s of data) {
      const c = Math.round(Number(s.total) * 100)
      totalCents += c
      byMethodCents[s.payment_method] = (byMethodCents[s.payment_method] ?? 0) + c
    }
    summary.count += data.length
    if (data.length < 1000) break
  }
  summary.total = totalCents / 100
  for (const [k, v] of Object.entries(byMethodCents)) summary.byMethod[k] = v / 100
  return summary
}
