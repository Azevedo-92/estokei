'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

/** Botão da /plataforma que chama uma server action e mostra o resultado. */
export function PlatformActionButton({
  label,
  action,
}: {
  label: string
  action: () => Promise<{ ok: boolean; message: string }>
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await action()
          if (!res.ok) return void toast.error(res.message)
          toast.success(res.message)
          router.refresh()
        })
      }
      className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
    >
      {pending ? 'Aguarde…' : label}
    </button>
  )
}
