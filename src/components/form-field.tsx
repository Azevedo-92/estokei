/** Classe padrão dos campos de formulário (input, select, textarea). */
export const INPUT_CLASS =
  'w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60'

/** Rótulo + campo + mensagem de erro, no padrão das telas de cadastro. */
export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      {children}
      {error ? (
        <span className="block text-xs text-rose-600">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  )
}

/** Estado devolvido pelas Server Actions de formulário. */
export type FormState = {
  ok: boolean
  message?: string
  fieldErrors?: Record<string, string[] | undefined>
}
