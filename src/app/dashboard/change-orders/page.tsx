import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const statusColor: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  submitted: 'bg-blue-100 text-blue-700',
  office_review: 'bg-purple-100 text-purple-700',
  sent_to_client: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  voided: 'bg-zinc-100 text-zinc-400',
}

export default async function ChangeOrdersPage() {
  const supabase = await createClient()

  const { data: cosRaw } = await supabase
    .from('change_orders')
    .select('id, co_number, title, status, total, submitted_at, project_id, projects(name)')
    .order('submitted_at', { ascending: false, nullsFirst: false })

  const cos = cosRaw as Array<{
    id: string
    co_number: number
    title: string
    status: string
    total: number
    submitted_at: string | null
    project_id: string
    projects: { name?: string } | null
  }> | null

  const pending = cos?.filter(co => ['submitted', 'office_review'].includes(co.status)) ?? []
  const other = cos?.filter(co => !['submitted', 'office_review'].includes(co.status)) ?? []

  function COTable({ items }: { items: typeof cos }) {
    if (!items?.length) return <p className="text-sm text-zinc-500">None.</p>
    return (
      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-zinc-500">CO #</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Title</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Project</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
              <th className="text-right px-4 py-3 font-medium text-zinc-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((co) => (
              <tr key={co.id} className="border-b last:border-0 hover:bg-zinc-50">
                <td className="px-4 py-3 font-mono text-zinc-500">CO-{String(co.co_number).padStart(3, '0')}</td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/projects/${co.project_id}/change-orders/${co.id}`} className="font-medium text-zinc-900 hover:underline">
                    {co.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-500">{(co.projects as { name?: string })?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[co.status]}`}>
                    {co.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">${Number(co.total).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900">Change Orders</h1>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide">Needs Attention ({pending.length})</h2>
          <COTable items={pending} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">All Change Orders</h2>
        <COTable items={cos} />
      </section>
    </div>
  )
}
