'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

type Attachment = { id: string; file_url: string; file_name: string }

export function AttachmentManager({
  attachments, canEdit,
}: {
  attachments: Attachment[]; canEdit: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function remove(a: Attachment) {
    setLoading(a.id)
    setError(null)
    // file_url is the public URL; derive the storage path after the bucket name.
    const marker = '/attachments/'
    const idx = a.file_url.indexOf(marker)
    if (idx !== -1) {
      const path = a.file_url.slice(idx + marker.length)
      await supabase.storage.from('attachments').remove([path])
    }
    const { error: delErr } = await supabase.from('change_order_attachments').delete().eq('id', a.id)
    if (delErr) { setError(delErr.message); setLoading(null); return }
    setLoading(null)
    router.refresh()
  }

  if (!attachments.length) return <p className="text-sm text-zinc-500">No attachments.</p>

  return (
    <div className="space-y-2">
      {attachments.map(a => (
        <div key={a.id} className="flex items-center justify-between gap-2">
          <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
            📎 {a.file_name}
          </a>
          {canEdit && (
            <button
              onClick={() => remove(a)}
              disabled={loading === a.id}
              className="text-zinc-400 hover:text-red-500"
              aria-label="Delete attachment"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
