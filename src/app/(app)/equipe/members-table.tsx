'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { changeMemberRoleAction, removeMemberAction } from './actions'
import { formatDateBR } from '@/lib/utils'

export type MemberRow = {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  full_name: string | null
  email: string | null
  created_at: string
  isCurrentUser: boolean
}

const ROLE_LABEL: Record<MemberRow['role'], string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Membro',
}

const ROLE_COLOR: Record<MemberRow['role'], string> = {
  owner: 'bg-violet-100 text-violet-800 border-violet-200',
  admin: 'bg-sky-100 text-sky-800 border-sky-200',
  member: 'bg-slate-100 text-slate-700 border-slate-200',
}

export function MembersTable({
  members,
  currentUserRole,
}: {
  members: MemberRow[]
  currentUserRole: MemberRow['role']
}) {
  const [pending, start] = useTransition()
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'

  function onRoleChange(id: string, role: MemberRow['role']) {
    start(async () => {
      try {
        await changeMemberRoleAction(id, role)
        toast.success('Papel atualizado.')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao atualizar.')
      }
    })
  }

  function onRemove(m: MemberRow) {
    const label = m.full_name || m.email || m.user_id
    if (!confirm(`Remover ${label} da organização?`)) return
    start(async () => {
      try {
        await removeMemberAction(m.id)
        toast.success('Membro removido.')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao remover.')
      }
    })
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Nome</th>
            <th className="text-left px-4 py-3 font-medium">Papel</th>
            <th className="text-left px-4 py-3 font-medium">Desde</th>
            <th className="text-right px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-t">
              <td className="px-4 py-3">
                <div className="font-medium">
                  {m.full_name || m.email || '—'}
                  {m.isCurrentUser ? (
                    <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                  ) : null}
                </div>
                {m.full_name && m.email ? (
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                ) : null}
              </td>
              <td className="px-4 py-3">
                {canManage && !m.isCurrentUser ? (
                  <select
                    value={m.role}
                    disabled={pending}
                    onChange={(e) =>
                      onRoleChange(m.id, e.target.value as MemberRow['role'])
                    }
                    className="rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="member">Membro</option>
                  </select>
                ) : (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${ROLE_COLOR[m.role]}`}
                  >
                    {ROLE_LABEL[m.role]}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDateBR(m.created_at)}
              </td>
              <td className="px-4 py-3 text-right">
                {canManage && !m.isCurrentUser ? (
                  <button
                    type="button"
                    onClick={() => onRemove(m)}
                    disabled={pending}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Remover
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
