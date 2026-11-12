'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Truck,
  UsersRound,
  Palette,
  LifeBuoy,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  match?: (pathname: string) => boolean
  badgeKey?: string
  /** Só dono e administradores veem. */
  adminOnly?: boolean
}

const NAV: NavItem[] = [
  { href: '/painel', label: 'Painel', icon: LayoutDashboard, match: (p) => p === '/painel' },
  { href: '/produtos', label: 'Produtos', icon: Package, match: (p) => p.startsWith('/produtos') },
  { href: '/estoque', label: 'Estoque', icon: ArrowLeftRight, match: (p) => p.startsWith('/estoque') },
  { href: '/fornecedores', label: 'Fornecedores', icon: Truck, match: (p) => p.startsWith('/fornecedores') },
  { href: '/equipe', label: 'Equipe', icon: UsersRound, match: (p) => p.startsWith('/equipe') },
  {
    href: '/configuracoes/marca',
    label: 'Marca',
    icon: Palette,
    match: (p) => p.startsWith('/configuracoes/marca'),
  },
  {
    href: '/configuracoes/plano',
    label: 'Plano e pagamento',
    icon: CreditCard,
    match: (p) => p.startsWith('/configuracoes/plano'),
  },
  { href: '/suporte', label: 'Suporte', icon: LifeBuoy, match: (p) => p.startsWith('/suporte') },
]

export function SidebarNav({
  badges,
  isAdmin = false,
}: {
  badges?: Record<string, number>
  /** Dono ou administrador: vê os itens adminOnly. */
  isAdmin?: boolean
}) {
  const pathname = usePathname()

  return (
    <nav className="flex-1 p-3 space-y-0.5">
      {NAV.filter((item) => isAdmin || !item.adminOnly).map((item) => {
        const active = item.match ? item.match(pathname) : pathname === item.href
        const Icon = item.icon
        const badgeCount = item.badgeKey ? badges?.[item.badgeKey] ?? 0 : 0
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            {active ? (
              <span
                aria-hidden
                className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                style={{ background: 'var(--brand)' }}
              />
            ) : null}
            <Icon
              className={`h-4 w-4 shrink-0 transition-colors ${
                active ? '' : 'text-muted-foreground group-hover:text-foreground'
              }`}
              style={active ? { color: 'var(--brand)' } : undefined}
            />
            <span className="flex-1">{item.label}</span>
            {badgeCount > 0 ? (
              <span
                className="inline-flex items-center justify-center rounded-full h-5 min-w-[20px] px-1.5 text-[10px] font-semibold text-white"
                style={{ background: 'var(--brand)' }}
              >
                {badgeCount}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
