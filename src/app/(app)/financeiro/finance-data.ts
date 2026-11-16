import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type OpenSummary = {
  receber: { open: number; overdue: number; next7: number }
  pagar: { open: number; overdue: number; next7: number }
}

/**
 * Totais das contas em aberto (vencidas e vencendo nos próximos 7 dias), por
 * tipo. Lê em páginas de 1.000 (limite do Supabase) até 20 mil contas.
 */
export async function openSummary(supabase: Supabase, organizationId: string, today: string, in7: string): Promise<OpenSummary> {
  const c = { receber: { open: 0, overdue: 0, next7: 0 }, pagar: { open: 0, overdue: 0, next7: 0 } }
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from('financial_entries')
      .select('kind, amount, due_date')
      .eq('organization_id', organizationId)
      .eq('status', 'aberto')
      .order('due_date')
      .range(page * 1000, page * 1000 + 999)
    if (error || !data) break
    for (const e of data) {
      const k = e.kind === 'pagar' ? c.pagar : c.receber
      const cents = Math.round(Number(e.amount) * 100)
      k.open += cents
      if (e.due_date < today) k.overdue += cents
      else if (e.due_date <= in7) k.next7 += cents
    }
    if (data.length < 1000) break
  }
  const toReais = (v: { open: number; overdue: number; next7: number }) => ({
    open: v.open / 100,
    overdue: v.overdue / 100,
    next7: v.next7 / 100,
  })
  return { receber: toReais(c.receber), pagar: toReais(c.pagar) }
}

/** Busca paginada de linhas para o fluxo de caixa (até 20 mil). */
export async function fetchAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  for (let page = 0; page < 20; page++) {
    const { data, error } = await run(page * 1000, page * 1000 + 999)
    if (error || !data) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}
