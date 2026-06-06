import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const statusColor: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
}

export default async function QuotesPage() {
  const supabase = await createClient()

  const { data: quotesRaw } = await supabase
    .from('quotes')
    .select('id, version, status, total, created_at, project_id, projects:project_id(name)')
    .order('created_at', { ascending: false })

  const quotes = quotesRaw as Array<{
    id: string; version: number; status: string; total: number
    created_at: string; project_id: string; projects: { name?: string } | null
  }> | null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Quotes</h1>
      {!quotes?.length ? (
        <p className="text-sm text-zinc-500">No quotes yet. Create one from a project.</p>
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
              {quotes.map(q => (
                <tr key={q.id} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {q.projects?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/projects/${q.project_id}/quotes/${q.id}`} className="text-zinc-900 hover:underline">
                      v{q.version}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[q.status]}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">${Number(q.total).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
