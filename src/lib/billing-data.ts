import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { billingState, type BillingState, type PaymentRow } from '@/lib/billing'
import { todayISO } from '@/lib/utils'

export type SubscriptionInfo = {
  plan: string
  cycle: string
  value: number
  billing_name: string
  billing_document: string
  billing_email: string
  canceled_at: string | null
}

/** Cobrança com a nota fiscal dela (preenchida pelo webhook quando há nota automática). */
export type PaymentWithInvoice = PaymentRow & {
  invoice_status: string | null
  invoice_number: string | null
  invoice_pdf_url: string | null
}

/**
 * Assinatura e cobranças da empresa, com RLS: só dono e administradores
 * enxergam (para os demais volta tudo vazio, como "sem assinatura").
 */
export const loadBilling = cache(
  async (
    organizationId: string
  ): Promise<{ subscription: SubscriptionInfo | null; payments: PaymentWithInvoice[]; state: BillingState }> => {
    const supabase = await createClient()
    const [{ data: subscription }, { data: payments }] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('plan, cycle, value, billing_name, billing_document, billing_email, canceled_at')
        .eq('organization_id', organizationId)
        .maybeSingle(),
      supabase
        .from('subscription_payments')
        .select('id, status, value, due_date, paid_at, invoice_url, deleted, invoice_status, invoice_number, invoice_pdf_url')
        .eq('organization_id', organizationId)
        .order('due_date', { ascending: false })
        .limit(60),
    ])
    const rows = payments ?? []
    return {
      subscription: subscription ?? null,
      payments: rows,
      state: billingState(subscription ?? null, rows, todayISO()),
    }
  }
)
