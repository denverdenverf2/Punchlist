'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type CO = {
  id: string
  status: string
}

const transitions: Record<string, { label: string; nextStatus: string; roles: string[] }[]> = {
  submitted: [
    { label: 'Take to Office Review', nextStatus: 'office_review', roles: ['owner', 'office'] },
  ],
  office_review: [
    { label: 'Send to Client', nextStatus: 'sent_to_client', roles: ['owner', 'office'] },
    { label: 'Void', nextStatus: 'voided', roles: ['owner', 'office'] },
  ],
}

export function COStatusActions({ co, userRole, projectId }: { co: CO; userRole: string; projectId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  const available = transitions[co.status]?.filter(t => t.roles.includes(userRole)) ?? []
  if (!available.length) return null

  async function advance(nextStatus: string) {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const updates = { status: nextStatus } as Record<string, unknown>
    if (nextStatus === 'office_review') { updates.reviewed_by = user!.id; updates.reviewed_at = new Date().toISOString() }

    await supabase.from('change_orders').update(updates).eq('id', co.id)

    if (comment.trim()) {
      await supabase.from('change_order_comments').insert({
        change_order_id: co.id,
        user_id: user!.id,
        body: comment,
      })
    }

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-zinc-50">
      <h3 className="text-sm font-semibold text-zinc-700">Actions</h3>
      <div className="space-y-1">
        <Label className="text-xs">Add a comment (optional)</Label>
        <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Note for the record…" />
      </div>
      <div className="flex gap-2 flex-wrap">
        {available.map(t => (
          <Button key={t.nextStatus} size="sm" onClick={() => advance(t.nextStatus)} disabled={loading}>
            {t.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
