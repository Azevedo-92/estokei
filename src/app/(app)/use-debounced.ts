'use client'

import { useEffect, useState } from 'react'

/** Valor com espera curta entre teclas (o leitor de código de barras digita rápido e manda Enter). */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
