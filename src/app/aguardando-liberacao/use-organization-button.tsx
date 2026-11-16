'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { switchOrganizationAction } from '../(app)/org-actions'

/** Passa a usar outra empresa (já liberada) da qual a pessoa participa. */
export function UseOrganizationButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await switchOrganizationAction(id)
          if (!res.ok) return void toast.error(res.message)
          router.push('/painel')
          router.refresh()
        })
      }
      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
    >
      <span className="truncate">{name}</span>
      <span className="shrink-0 text-xs font-medium text-primary">Usar esta empresa →</span>
    </button>
  )
}
