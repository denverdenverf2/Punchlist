import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const statusColor: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  superseded: 'bg-amber-100 text-amber-700',
}

export default async function BidsPage() {
  const supabase = await createClient()

  const { data: bidsRaw } = await supabase
    .from('bids')
    .select('id, version, status, total, created_at, project_id, projects:project_id(name)')
    .order('created_at', { ascending: false })

  const bids = bidsRaw as Array<{
    id: string; version: number; status: string; total: number
    created_at: string; project_id: string; projects: { name?: string } | null
  }> | null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Bids</h1>
        <span className="text-xs text-zinc-400">Generate a bid from a quote&apos;s detail page</span>
      </div>

      {!bids?.length ? (
        <p className="text-sm text-zinc-500">
          No bids yet. A bid is a customer-facing snapshot of a quote, with full
          revision history.
        </p>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Project</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Version</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {bids.map(b => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">{b.projects?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/bids/${b.id}`} className="text-zinc-900 hover:underline">
                      v{b.version}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[b.status]}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">${Number(b.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
