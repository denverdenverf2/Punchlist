'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const transitions: Record<string, { label: string; next: string; roles: string[] }[]> = {
  draft: [
    { label: 'Mark as Sent', next: 'sent', roles: ['owner', 'office'] },
  ],
  sent: [
    { label: 'Mark as Accepted', next: 'accepted', roles: ['owner', 'office'] },
    { label: 'Mark as Rejected', next: 'rejected', roles: ['owner', 'office'] },
  ],
}

export function QuoteStatusActions({
  quoteId,
  currentStatus,
  userRole,
  projectId,
}: {
  quoteId: string
  currentStatus: string
  userRole: string
  projectId: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const available = transitions[currentStatus]?.filter(t => t.roles.includes(userRole)) ?? []
  if (!available.length) return null

  async function advance(next: string) {
    setLoading(true)
    await supabase.from('quotes').update({ status: next }).eq('id', quoteId)

    // If accepted, set contract value on project from quote total
    if (next === 'accepted') {
      const { data: q } = await supabase.from('quotes').select('total').eq('id', quoteId).single()
      if (q) await supabase.from('projects').update({ contract_value: q.total }).eq('id', projectId)
    }

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-zinc-50 flex gap-2">
      {available.map(t => (
        <Button key={t.next} size="sm" onClick={() => advance(t.next)} disabled={loading}>
          {t.label}
        </Button>
      ))}
    </div>
  )
}
