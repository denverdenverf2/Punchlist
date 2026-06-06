import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-zinc-100 text-zinc-600',
  on_hold: 'bg-amber-100 text-amber-700',
}

const coStatusColor: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  submitted: 'bg-blue-100 text-blue-700',
  office_review: 'bg-purple-100 text-purple-700',
  sent_to_client: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  voided: 'bg-zinc-100 text-zinc-400',
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [projectRes, changeOrdersRes, quotesRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('change_orders').select('id, co_number, title, status, total, submitted_at').eq('project_id', id).order('co_number'),
    supabase.from('quotes').select('id, version, status, total, created_at').eq('project_id', id).order('version'),
  ])

  const project = projectRes.data as {
    id: string; name: string; address: string | null; status: string; contract_value: number | null
  } | null
  const changeOrders = changeOrdersRes.data as Array<{
    id: string; co_number: number; title: string; status: string; total: number; submitted_at: string | null
  }> | null
  const quotes = quotesRes.data as Array<{
    id: string; version: number; status: string; total: number; created_at: string
  }> | null

  if (!project) notFound()

  const approvedCOTotal = changeOrders?.filter(co => co.status === 'approved').reduce((sum, co) => sum + Number(co.total), 0) ?? 0
  const revisedValue = (Number(project.contract_value) || 0) + approvedCOTotal

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">{project.name}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[project.status]}`}>
              {project.status.replace('_', ' ')}
            </span>
          </div>
          {project.address && <p className="text-sm text-zinc-500 mt-1">{project.address}</p>}
        </div>
        <div className="text-right text-sm">
          {project.contract_value != null && (
            <p className="text-zinc-500">Original: <span className="font-medium text-zinc-900">${Number(project.contract_value).toLocaleString()}</span></p>
          )}
          {approvedCOTotal > 0 && (
            <p className="text-zinc-500">Approved COs: <span className="font-medium text-green-700">+${approvedCOTotal.toLocaleString()}</span></p>
          )}
          {project.contract_value != null && (
            <p className="text-zinc-500 mt-1 border-t pt-1">Revised: <span className="font-bold text-zinc-900">${revisedValue.toLocaleString()}</span></p>
          )}
        </div>
      </div>

      <Tabs defaultValue="change-orders">
        <TabsList>
          <TabsTrigger value="change-orders">Change Orders ({changeOrders?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="quotes">Quotes ({quotes?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="change-orders" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Link href={`/dashboard/projects/${id}/change-orders/new`} className={buttonVariants({ size: 'sm' })}>
              <Plus className="h-4 w-4 mr-1" /> New Change Order
            </Link>
          </div>
          {!changeOrders?.length ? (
            <p className="text-sm text-zinc-500">No change orders yet.</p>
          ) : (
            <div className="rounded-lg border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500">CO #</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-zinc-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {changeOrders.map((co) => (
                    <tr key={co.id} className="border-b last:border-0 hover:bg-zinc-50">
                      <td className="px-4 py-3 font-mono text-zinc-500">CO-{String(co.co_number).padStart(3, '0')}</td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/projects/${id}/change-orders/${co.id}`} className="font-medium text-zinc-900 hover:underline">
                          {co.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${coStatusColor[co.status]}`}>
                          {co.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">${Number(co.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="quotes" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Link href={`/dashboard/projects/${id}/quotes/new`} className={buttonVariants({ size: 'sm' })}>
              <Plus className="h-4 w-4 mr-1" /> New Quote
            </Link>
          </div>
          {!quotes?.length ? (
            <p className="text-sm text-zinc-500">No quotes yet.</p>
          ) : (
            <div className="rounded-lg border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500">Version</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-zinc-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id} className="border-b last:border-0 hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/projects/${id}/quotes/${q.id}`} className="font-medium text-zinc-900 hover:underline">
                          v{q.version}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 capitalize">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
