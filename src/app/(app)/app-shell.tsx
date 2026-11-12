'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { EstokeiMark } from '@/components/estokei-mark'

/**
 * Shell responsivo do app:
 * - Desktop (md+): sidebar fixo à esquerda (w-64), main ao lado.
 * - Mobile: sidebar escondido, abre como overlay quando clica no hamburger.
 * Fecha automaticamente ao trocar de rota.
 */
export function AppShell({
  children,
  sidebar,
}: {
  children: React.ReactNode
  sidebar: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Fecha o sidebar toda vez que a rota muda
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  // Bloqueia scroll do body quando o menu mobile está aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [open])

  return (
    <div className="app-shell min-h-screen md:flex">
      {/* Barra superior — só mobile */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 backdrop-blur h-14 px-4">
        <EstokeiMark />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-2 -mr-2 rounded-md hover:bg-accent"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Backdrop mobile */}
      {open ? (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r bg-sidebar/95 backdrop-blur flex flex-col
          transition-transform duration-200 ease-out
          md:sticky md:top-0 md:h-screen md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Botão de fechar — só mobile */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="md:hidden absolute top-3 right-3 z-10 p-2 rounded-md hover:bg-accent"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex-1 overflow-y-auto flex flex-col">{sidebar}</div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
