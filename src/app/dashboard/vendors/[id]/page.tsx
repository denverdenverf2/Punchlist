import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { VendorDetailActions } from './vendor-detail-actions'

const statusColor: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-zinc-100 text-zinc-500',
}

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [vendorRes, quotesRes] = await Promise.all([
    supabase.from('vendors').select('*').eq('id', id).single(),
    supabase
      .from('vendor_quotes')
      .select('id, description, amount, status, received_at, created_at, project_id, projects:project_id(name)')
      .eq('vendor_id', id)
      .order('created_at', { ascending: false }),
  ])

  const vendor = vendorRes.data as {
    id: string; name: string; trade: string | null
    contact_name: string | null; email: string | null; phone: string | null; notes: string | null
  } | null

  if (!vendor) notFound()

  const quotes = (quotesRes.data as Array<{
    id: string; description: string | null; amount: number; status: string
    received_at: string | null; created_at: string
    project_id: string; projects: { name?: string } | null
  }>) ?? []

  const totalQuoted = quotes.reduce((s, q) => s + Number(q.amount), 0)

  // Rollup by project.
  const byProject = new Map<string, { name: string; total: number; count: number }>()
  for (const q of quotes) {
    const key = q.project_id
    const prev = byProject.get(key) ?? { name: q.projects?.name ?? 'Unknown project', total: 0, count: 0 }
    prev.total += Number(q.amount)
    prev.count += 1
    byProject.set(key, prev)
  }
  const projectRollup = [...byProject.entries()].map(([projectId, v]) => ({ projectId, ...v }))

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/vendors" className="text-sm text-blue-600 hover:underline">← Vendors</Link>
          <h1 className="text-2xl font-bold text-zinc-900 mt-1">{vendor.name}</h1>
          {vendor.trade && <p className="text-sm text-zinc-500 capitalize">{vendor.trade}</p>}
        </div>
        <VendorDetailActions vendor={vendor} hasQuotes={quotes.length > 0} />
      </div>

      {/* Profile */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-zinc-500">Contact name</span><p className="text-zinc-900">{vendor.contact_name ?? '—'}</p></div>
          <div><span className="text-zinc-500">Phone</span><p className="text-zinc-900">{vendor.phone ?? '—'}</p></div>
          <div><span className="text-zinc-500">Email</span><p className="text-zinc-900">{vendor.email ?? '—'}</p></div>
          {vendor.notes && (
            <div className="col-span-2"><span className="text-zinc-500">Notes</span><p className="text-zinc-700 whitespace-pre-wrap">{vendor.notes}</p></div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-zinc-500">Quotes logged</p>
          <p className="text-lg font-bold text-zinc-900">{quotes.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-zinc-500">Total quoted</p>
          <p className="text-lg font-bold text-zinc-900">${totalQuoted.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-zinc-500">Projects</p>
          <p className="text-lg font-bold text-zinc-900">{projectRollup.length}</p>
        </div>
      </div>

      {/* Project rollup */}
      {projectRollup.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">By project</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {projectRollup.map(p => (
              <Link
                key={p.projectId}
                href={`/dashboard/projects/${p.projectId}`}
                className="flex items-center justify-between text-sm rounded px-2 py-1.5 -mx-2 hover:bg-zinc-50"
              >
                <span className="font-medium text-zinc-900">{p.name}</span>
                <span className="flex items-center gap-3 text-zinc-500">
                  <span>{p.count} quote{p.count === 1 ? '' : 's'}</span>
                  <span className="font-medium text-zinc-900 tabular-nums">${p.total.toLocaleString()}</span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quote history */}
      <Card>
        <CardHeader><CardTitle className="text-base">Quote history</CardTitle></CardHeader>
        <CardContent>
          {!quotes.length ? (
            <p className="text-sm text-zinc-500">No quotes logged for this vendor yet. They&apos;re created when you assign this vendor to a quote line item.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 font-medium text-zinc-500">Project</th>
                  <th className="text-left py-2 font-medium text-zinc-500">Description</th>
                  <th className="text-left py-2 font-medium text-zinc-500">Status</th>
                  <th className="text-right py-2 font-medium text-zinc-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id} className="border-b last:border-0">
                    <td className="py-2">
                      <Link href={`/dashboard/projects/${q.project_id}`} className="text-zinc-900 hover:underline">
                        {q.projects?.name ?? '—'}
                      </Link>
                    </td>
                    <td className="py-2 text-zinc-600">{q.description ?? '—'}</td>
                    <td className="py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[q.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">${Number(q.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
