import { requireOrganization } from '@/lib/auth'
import { contrastText, resolveBrandColor } from '@/lib/branding'
import { formatDateBR } from '@/lib/utils'
import { canManageTeam } from '@/lib/team'
import { loadBilling } from '@/lib/billing-data'
import { EstokeiMark } from '@/components/estokei-mark'
import { AppShell } from './app-shell'
import { SidebarNav } from './sidebar-nav'
import { SignOutButton } from './sign-out-button'
import { OrgSwitcher } from './org-switcher'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { isPlatformAdmin } from '@/lib/platform'

function userInitials(email: string): string {
  const name = email.split('@')[0]
  const parts = name.split(/[._-]+/).filter(Boolean)
  return (
    (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? name[1] ?? '')
  ).toUpperCase().slice(0, 2)
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { organization, organizations, user, role } = await requireOrganization()
  const brandColor = resolveBrandColor(organization.primary_color)
  const hasCustomLogo = !!organization.logo_url

  // Para dono e administradores: situação da assinatura (aviso de pagamento atrasado).
  const billing = canManageTeam(role) ? await loadBilling(organization.id) : null
  const overdue = billing?.state.kind === 'overdue' ? billing.state : null

  const sidebar = (
    <>
      <div className="px-5 pt-5 pb-4">
        {hasCustomLogo ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={organization.logo_url!}
              alt={organization.name}
              className="h-10 w-10 rounded-lg object-contain bg-muted/40 ring-1 ring-border/60"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{organization.name}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                no Estokei
              </div>
            </div>
          </div>
        ) : (
          <div>
            <EstokeiMark />
            <div
              className="mt-2 text-xs font-medium tracking-wide uppercase truncate"
              style={{ color: 'var(--brand)' }}
            >
              {organization.name}
            </div>
          </div>
        )}
        <OrgSwitcher currentId={organization.id} organizations={organizations} />
      </div>

      <div className="mx-3 border-t border-border/60" />

      <SidebarNav isAdmin={canManageTeam(role)} />

      <div className="mx-3 border-t border-border/60" />

      <div className="p-3">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
            style={{ background: brandColor }}
            aria-hidden
          >
            {userInitials(user.email ?? 'U')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">
              {user.email?.split('@')[0]}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {user.email}
            </div>
          </div>
        </div>
        {isPlatformAdmin(user.email) ? (
          <Link
            href="/plataforma"
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <Building2 className="h-3.5 w-3.5" aria-hidden />
            Plataforma (empresas)
          </Link>
        ) : null}
        <SignOutButton />
      </div>
    </>
  )

  // Sobrescreve os tokens do shadcn (primary, ring, sidebar-*) para que TODOS
  // os botões e estados focus/hover da área logada respondam à cor da marca da
  // organização, não só os elementos que usam var(--brand) diretamente.
  const brandStyle: React.CSSProperties & Record<string, string> = {
    '--brand': brandColor,
    '--primary': brandColor,
    '--primary-foreground': contrastText(brandColor),
    '--ring': brandColor,
    '--sidebar-primary': brandColor,
    '--sidebar-primary-foreground': contrastText(brandColor),
    '--sidebar-ring': brandColor,
  }

  return (
    <div style={brandStyle}>
      <AppShell sidebar={sidebar}>
          {overdue ? (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              <span>
                A mensalidade de {formatDateBR(overdue.payment.due_date)} está em aberto. Pague até{' '}
                <strong>{formatDateBR(overdue.suspendOn)}</strong> para o acesso da equipe não ser
                suspenso.
              </span>
              <a
                href={overdue.payment.invoice_url ?? '/configuracoes/plano'}
                target={overdue.payment.invoice_url ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
              >
                Pagar agora
              </a>
            </div>
          ) : null}
          {children}
      </AppShell>
    </div>
  )
}
