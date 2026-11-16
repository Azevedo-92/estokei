'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import type { FormState } from '@/components/form-field'

const cancelSchema = z.object({
  sale_id: z.string().uuid(),
  reason: z.string().trim().min(3, 'Informe o motivo do cancelamento.').max(500),
})

// Cancelar devolve o estoque (movimentos de estorno) — só dono/administrador.
export async function cancelSaleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { role } = await requireOrganization()
  if (!canManageTeam(role)) {
    return { ok: false, message: 'Só o dono e os administradores cancelam vendas.' }
  }
  const parsed = cancelSchema.safeParse({
    sale_id: (formData.get('sale_id') as string) ?? '',
    reason: (formData.get('reason') as string) ?? '',
  })
  if (!parsed.success) {
    return { ok: false, message: 'Corrija os campos destacados.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_sale', {
    p_sale_id: parsed.data.sale_id,
    p_reason: parsed.data.reason,
  })
  if (error) {
    const known = ['Esta venda já foi cancelada', 'Venda não encontrada', 'Informe o motivo']
    return {
      ok: false,
      message: known.some((k) => error.message.startsWith(k))
        ? error.message
        : 'Não foi possível cancelar a venda. Tente de novo.',
    }
  }

  revalidatePath('/vendas')
  revalidatePath(`/vendas/${parsed.data.sale_id}`)
  revalidatePath('/produtos')
  revalidatePath('/estoque')
  revalidatePath('/painel')
  return { ok: true, message: 'Venda cancelada e estoque devolvido.' }
}
