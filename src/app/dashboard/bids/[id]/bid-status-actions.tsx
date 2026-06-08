'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Send, Check, X } from 'lucide-react'

export function BidStatusActions({
  bidId, projectId, status, total, hasContract,
}: {
  bidId: string; projectId: string; status: string; total: number; hasContract: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function update(next: string) {
    setLoading(true)
    setError(null)

    const patch: Record<string, unknown> = { status: next }
    if (next === 'sent') patch.sent_at = new Date().toISOString()
    if (next === 'accepted' || next === 'rejected') patch.responded_at = new Date().toISOString()

    const { error: updErr } = await supabase.from('bids').update(patch).eq('id', bidId)
    if (updErr) { setError(updErr.message); setLoading(false); return }

    // Accepting a bid spins up a pending contract for signature.
    if (next === 'accepted' && !hasContract) {
      const { error: cErr } = await supabase.from('contracts').insert({
        project_id: projectId,
        bid_id: bidId,
        status: 'pending',
        contract_value: total,
      })
      if (cErr) { setError(cErr.message); setLoading(false); return }
    }

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {status === 'draft' && (
          <Button size="sm" onClick={() => update('sent')} disabled={loading}>
            <Send className="h-4 w-4 mr-1" /> Mark Sent
          </Button>
        )}
        {(status === 'draft' || status === 'sent') && (
          <>
            <Button size="sm" variant="outline" onClick={() => update('accepted')} disabled={loading}>
              <Check className="h-4 w-4 mr-1" /> Accepted
            </Button>
            <Button size="sm" variant="outline" onClick={() => update('rejected')} disabled={loading}>
              <X className="h-4 w-4 mr-1" /> Rejected
            </Button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
