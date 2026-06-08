'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FileSignature } from 'lucide-react'

type SnapshotLine = {
  description: string; quantity: number; unit: string
  unit_cost: number; markup_percent: number; total: number
  cost_code: string | null; category: string
}

export function GenerateBidButton({
  quoteId, projectId, quoteTotal, hasBids,
}: {
  quoteId: string; projectId: string; quoteTotal: number; hasBids?: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()

    // Freeze the quote's current sections + lines into the bid snapshot.
    const { data: sections } = await supabase
      .from('quote_sections')
      .select('name, sort_order, line_items(description, quantity, unit, unit_cost, markup_percent, total, cost_code, category, sort_order)')
      .eq('quote_id', quoteId)
      .order('sort_order')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshot = ((sections as any[]) ?? []).map(s => ({
      name: s.name as string,
      items: (s.line_items as SnapshotLine[]) ?? [],
    }))

    // Next bid version is per-project (bids share a version sequence).
    const { data: existing } = await supabase
      .from('bids')
      .select('version')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
    const version = existing && existing.length > 0 ? existing[0].version + 1 : 1

    // Supersede prior open bids from this quote — only one live revision at a time.
    await supabase
      .from('bids')
      .update({ status: 'superseded' })
      .eq('quote_id', quoteId)
      .in('status', ['draft', 'sent'])

    const { data: bid, error: bidErr } = await supabase
      .from('bids')
      .insert({
        project_id: projectId,
        quote_id: quoteId,
        version,
        status: 'draft',
        total: quoteTotal,
        snapshot,
        created_by: user!.id,
      })
      .select('id')
      .single()

    if (bidErr || !bid) { setError(bidErr?.message ?? 'Failed to generate bid'); setLoading(false); return }

    router.push(`/dashboard/bids/${bid.id}`)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={handleClick} disabled={loading}>
        <FileSignature className="h-4 w-4 mr-1" />
        {loading ? 'Generating…' : hasBids ? 'New Bid Revision' : 'Generate Bid'}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
