'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'
import { switchOrganizationAction } from './org-actions'

/** Seletor de empresa no menu — só aparece para quem participa de mais de uma. */
export function OrgSwitcher({
  currentId,
  organizations,
}: {
  currentId: string
  organizations: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  if (organizations.length < 2) return null

  return (
    <label className="mt-3 flex items-center gap-2 rounded-lg border bg-background/60 px-2.5 py-1.5 text-xs">
      <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="sr-only">Trocar de empresa</span>
      <select
        value={currentId}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value
          start(async () => {
            const res = await switchOrganizationAction(id)
            if (!res.ok) {
              toast.error(res.message)
              return
            }
            router.push('/painel')
            router.refresh()
          })
        }}
        className="min-w-0 flex-1 bg-transparent outline-none disabled:opacity-60"
      >
        {organizations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  )
}
