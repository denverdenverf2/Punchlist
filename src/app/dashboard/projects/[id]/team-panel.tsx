'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserPlus, X } from 'lucide-react'

type Member = { user_id: string; role: string; full_name: string | null; email: string }
type Assignable = { id: string; full_name: string | null; email: string; role: string }

export function TeamPanel({
  projectId, members, assignable,
}: {
  projectId: string; members: Member[]; assignable: Assignable[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedRole, setSelectedRole] = useState('foreman')

  // Don't offer people already on the project.
  const memberIds = new Set(members.map(m => m.user_id))
  const candidates = assignable.filter(a => !memberIds.has(a.id))

  async function addMember() {
    if (!selectedUser) return
    setLoading(true)
    setError(null)
    const { error: insErr } = await supabase
      .from('project_users')
      .insert({ project_id: projectId, user_id: selectedUser, role: selectedRole })
    if (insErr) { setError(insErr.message); setLoading(false); return }
    setSelectedUser('')
    setLoading(false)
    router.refresh()
  }

  async function removeMember(userId: string) {
    setLoading(true)
    setError(null)
    const { error: delErr } = await supabase
      .from('project_users')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)
    if (delErr) { setError(delErr.message); setLoading(false); return }
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {!members.length ? (
        <p className="text-sm text-zinc-500">No team members assigned yet.</p>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Role</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium text-zinc-900">{m.full_name ?? m.email}</td>
                  <td className="px-4 py-3 capitalize text-zinc-600">{m.role}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeMember(m.user_id)}
                      disabled={loading}
                      className="text-zinc-400 hover:text-red-500"
                      aria-label="Remove member"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add member */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed bg-zinc-50 p-3">
        <div className="flex-1 min-w-40">
          <Select value={selectedUser || 'none'} onValueChange={v => v && setSelectedUser(v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Select a person" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select a person…</SelectItem>
              {candidates.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.full_name ?? c.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
          <Select value={selectedRole} onValueChange={v => v && setSelectedRole(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="foreman">Foreman</SelectItem>
              <SelectItem value="office">Office</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={addMember} disabled={loading || !selectedUser}>
          <UserPlus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
