import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BidStatusActions } from './bid-status-actions'
import { BidNotesEditor } from './bid-notes-editor'

const statusColor: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  superseded: 'bg-amber-100 text-amber-700',
}

type SnapshotSection = {
  name: string
  items: Array<{
    description: string; quantity: number; unit: string
    unit_cost: number; markup_percent: number; total: number
    cost_code: string | null; category: string
  }>
}

export default async function BidDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [bidRes, contractRes] = await Promise.all([
    supabase
      .from('bids')
      .select('id, version, status, total, snapshot, notes, sent_at, responded_at, project_id, quote_id, projects:project_id(name)')
      .eq('id', id)
      .single(),
    supabase.from('contracts').select('id, status').eq('bid_id', id).maybeSingle(),
  ])

  const bid = bidRes.data as {
    id: string; version: number; status: string; total: number
    snapshot: SnapshotSection[] | null; notes: string | null
    sent_at: string | null; responded_at: string | null
    project_id: string; quote_id: string | null; projects: { name?: string } | null
  } | null

  if (!bid) notFound()

  // Version history: sibling bids from the same source quote (or project if no quote).
  const historyRes = bid.quote_id
    ? await supabase.from('bids').select('id, version, status, total').eq('quote_id', bid.quote_id).order('version')
    : await supabase.from('bids').select('id, version, status, total').eq('project_id', bid.project_id).order('version')
  const history = (historyRes.data as Array<{ id: string; version: number; status: string; total: number }>) ?? []

  const contract = contractRes.data as { id: string; status: string } | null
  const sections = bid.snapshot ?? []
  const notesEditable = bid.status === 'draft'

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{bid.projects?.name}</p>
          <h1 className="text-2xl font-bold text-zinc-900">Bid v{bid.version}</h1>
          {bid.quote_id && (
            <Link
              href={`/dashboard/projects/${bid.project_id}/quotes/${bid.quote_id}`}
              className="text-sm text-blue-600 hover:underline"
            >
              ← Source quote
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor[bid.status]}`}>
            {bid.status}
          </span>
          <BidStatusActions
            bidId={bid.id}
            projectId={bid.project_id}
            status={bid.status}
            total={Number(bid.total)}
            hasContract={!!contract}
          />
        </div>
      </div>

      {contract && (
        <div className="rounded-lg border bg-green-50 border-green-200 px-4 py-3 text-sm">
          <span className="font-medium text-green-800">Contract {contract.status}</span>
          <span className="text-green-700"> — created from this bid. </span>
          <Link href={`/dashboard/projects/${bid.project_id}`} className="text-green-800 underline">
            View project
          </Link>
        </div>
      )}

      {/* Frozen snapshot of the quote at bid time */}
      {sections.map((section, si) => (
        <Card key={si}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{section.name}</CardTitle>
              <span className="text-sm font-medium text-zinc-700">
                ${section.items.reduce((s, i) => s + Number(i.total), 0).toFixed(2)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 font-medium text-zinc-500">Description</th>
                  <th className="text-center py-2 font-medium text-zinc-500">Qty</th>
                  <th className="text-right py-2 font-medium text-zinc-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item, ii) => (
                  <tr key={ii} className="border-b last:border-0">
                    <td className="py-2">
                      {item.description}
                      <span className="ml-2 text-xs text-zinc-400 capitalize">{item.category}</span>
                    </td>
                    <td className="text-center py-2">{item.quantity} {item.unit}</td>
                    <td className="text-right py-2 tabular-nums">${Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      <div className="text-right text-lg font-bold text-zinc-900">
        Total: ${Number(bid.total).toFixed(2)}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Notes & Terms</CardTitle></CardHeader>
        <CardContent>
          <BidNotesEditor bidId={bid.id} initialNotes={bid.notes ?? ''} editable={notesEditable} />
        </CardContent>
      </Card>

      {history.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Revision history</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between text-sm rounded px-2 py-1.5 -mx-2 hover:bg-zinc-50">
                {h.id === bid.id ? (
                  <span className="font-medium text-zinc-900">Bid v{h.version} (this one)</span>
                ) : (
                  <Link href={`/dashboard/bids/${h.id}`} className="font-medium text-zinc-900 hover:underline">
                    Bid v{h.version}
                  </Link>
                )}
                <span className="flex items-center gap-3">
                  <span className="capitalize text-zinc-500">{h.status}</span>
                  <span className="font-medium tabular-nums">${Number(h.total).toFixed(2)}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
