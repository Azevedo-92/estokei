'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'

/** Botão de imprimir; com `auto`, abre a impressão assim que a página carrega. */
export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return
    const t = setTimeout(() => window.print(), 300)
    return () => clearTimeout(t)
  }, [auto])

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    >
      <Printer className="h-4 w-4" aria-hidden /> Imprimir cupom
    </button>
  )
}
