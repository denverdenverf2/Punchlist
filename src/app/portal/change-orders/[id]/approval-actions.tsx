'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function ClientApprovalActions({ coId }: { coId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)

  async function respond(status: 'approved' | 'rejected') {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('change_orders').update({
      status,
      approved_by: user!.id,
      client_responded_at: new Date().toISOString(),
    }).eq('id', coId)

    if (note.trim()) {
      await supabase.from('change_order_comments').insert({
        change_order_id: coId,
        user_id: user!.id,
        body: note,
      })
    }

    setDone(status)
    setLoading(false)
    router.refresh()
  }

  if (done) {
    return (
      <div className={`rounded-lg p-6 text-center ${done === 'approved' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
        <p className="text-lg font-semibold">
          {done === 'approved' ? '✓ Change order approved.' : '✗ Change order rejected.'}
        </p>
        <p className="text-sm mt-1">Your response has been recorded. The team has been notified.</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-6 space-y-4 bg-white">
      <h2 className="font-semibold text-zinc-900">Your Approval</h2>
      <p className="text-sm text-zinc-600">
        Please review the change order above and approve or reject. Your decision will be timestamped and recorded.
      </p>
      <Textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Optional note or questions…"
        rows={3}
      />
      <div className="flex gap-3">
        <Button onClick={() => respond('approved')} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700">
          Approve
        </Button>
        <Button onClick={() => respond('rejected')} disabled={loading} variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50">
          Reject
        </Button>
      </div>
    </div>
  )
}
