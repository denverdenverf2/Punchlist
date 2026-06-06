import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-zinc-100 text-zinc-600',
  on_hold: 'bg-amber-100 text-amber-700',
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, address, status, contract_value, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Projects</h1>
        <Link href="/dashboard/projects/new" className={buttonVariants({ size: 'sm' })}>
          <Plus className="h-4 w-4 mr-1" /> New Project
        </Link>
      </div>

      {!projects?.length ? (
        <p className="text-zinc-500 text-sm">No projects yet. Create your first one.</p>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Address</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Contract Value</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/projects/${p.id}`} className="font-medium text-zinc-900 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{p.address ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[p.status]}`}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700">
                    {p.contract_value != null ? `$${Number(p.contract_value).toLocaleString()}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
