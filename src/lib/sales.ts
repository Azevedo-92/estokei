// Contato comercial pelo WhatsApp: o link embaixo de cada plano abre a conversa
// com a mensagem pronta (a contratação em si é feita dentro do sistema).

/** Número que recebe os contatos de venda: DDI + DDD + número, só dígitos. */
export const SALES_WHATSAPP = '5527997346702'

export function whatsappLink(message: string): string {
  return `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(message)}`
}

/** `annual` null = a pessoa ainda não escolheu entre mensal e anual. */
export function planWhatsappLink(
  plan: { name: string; users: number },
  annual: boolean | null
): string {
  const billing = annual === null ? '' : `, com cobrança ${annual ? 'anual' : 'mensal'}`
  return whatsappLink(
    `Olá! Quero contratar o plano ${plan.name} do Estokei (até ${plan.users} pessoas)${billing}.`
  )
}
