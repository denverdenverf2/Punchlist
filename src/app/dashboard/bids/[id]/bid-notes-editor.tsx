'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function BidNotesEditor({
  bidId, initialNotes, editable,
}: {
  bidId: string; initialNotes: string; editable: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [notes, setNotes] = useState(initialNotes)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setLoading(true)
    setError(null)
    const { error: upErr } = await supabase.from('bids').update({ notes: notes || null }).eq('id', bidId)
    if (upErr) { setError(upErr.message); setLoading(false); return }
    setLoading(false)
    setEditing(false)
    router.refresh()
  }

  if (!editable) {
    return notes
      ? <p className="text-sm text-zinc-600 whitespace-pre-wrap">{notes}</p>
      : <p className="text-sm text-zinc-400">No notes.</p>
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        {notes
          ? <p className="text-sm text-zinc-600 whitespace-pre-wrap">{notes}</p>
          : <p className="text-sm text-zinc-400">No notes yet.</p>}
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit notes</Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Terms, payment schedule, exclusions…" />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save'}</Button>
        <Button size="sm" variant="outline" onClick={() => { setNotes(initialNotes); setEditing(false) }}>Cancel</Button>
      </div>
    </div>
  )
}
