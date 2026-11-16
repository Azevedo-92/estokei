// Dono da plataforma (quem libera, suspende e acompanha as empresas clientes).
// Definido pela variável de servidor PLATFORM_ADMIN_EMAILS (e-mails separados
// por vírgula) — não fica no banco, então nenhuma empresa consegue se dar esse
// acesso. A tela /plataforma usa o service role e por isso confere isto antes.

export type OrgStatus = 'active' | 'pending' | 'suspended'

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(email.trim().toLowerCase())
}

/** Motivos prontos ao suspender (também dá para escrever outro). */
export const SUSPENSION_REASONS = [
  'Pagamento pendente',
  'A pedido do cliente',
  'Uso em desacordo com os Termos de Uso',
] as const

export const ORG_STATUS_LABEL: Record<OrgStatus, string> = {
  active: 'Liberada',
  pending: 'Aguardando liberação',
  suspended: 'Suspensa',
}
