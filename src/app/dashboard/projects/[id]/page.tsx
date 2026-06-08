import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { EditProjectButton } from './edit-project'
import { TeamPanel } from './team-panel'

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

  const [projectRes, changeOrdersRes, quotesRes, bidsRes, clientsRes, vendorQuotesRes, teamRes, allProfilesRes] = await Promise.all([
    supabase.from('projects').select('*, client:client_id(full_name, email)').eq('id', id).single(),
    supabase.from('change_orders').select('id, co_number, title, status, total, submitted_at, created_at').eq('project_id', id).order('co_number'),
    supabase.from('quotes').select('id, version, status, total, created_at').eq('project_id', id).order('version'),
    supabase.from('bids').select('id, version, status, total, created_at').eq('project_id', id).order('version'),
    supabase.from('profiles').select('id, full_name, email').eq('role', 'client'),
    supabase.from('vendor_quotes').select('id, description, amount, status, received_at, created_at, vendor:vendor_id(name, trade)').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('project_users').select('user_id, role, profiles:user_id(full_name, email)').eq('project_id', id),
    supabase.from('profiles').select('id, full_name, email, role'),
  ])

  const project = projectRes.data as {
    id: string; name: string; address: string | null; status: string
    contract_value: number | null; client_id: string | null
    client: { full_name: string | null; email: string } | null
  } | null
  const changeOrders = changeOrdersRes.data as Array<{
    id: string; co_number: number; title: string; status: string; total: number; submitted_at: string | null; created_at: string
  }> | null
  const quotes = quotesRes.data as Array<{
    id: string; version: number; status: string; total: number; created_at: string
  }> | null
  const bids = bidsRes.data as Array<{
    id: string; version: number; status: string; total: number; created_at: string
  }> | null
  const clients = (clientsRes.data as Array<{ id: string; full_name: string | null; email: string }>) ?? []
  const vendorQuotes = vendorQuotesRes.data as Array<{
    id: string; description: string | null; amount: number; status: string; received_at: string | null; created_at: string
    vendor: { name: string; trade: string | null } | null
  }> | null
  const teamRaw = (teamRes.data as unknown as Array<{
    user_id: string; role: string; profiles: { full_name: string | null; email: string } | null
  }>) ?? []
  const team = teamRaw.map(t => ({
    user_id: t.user_id, role: t.role,
    full_name: t.profiles?.full_name ?? null, email: t.profiles?.email ?? '',
  }))
  const assignable = (allProfilesRes.data as Array<{ id: string; full_name: string | null; email: string; role: string }>) ?? []

  if (!project) notFound()

  // Synthesize an activity timeline from existing record timestamps.
  const activity = [
    ...(changeOrders ?? []).map(co => ({
      at: co.created_at, label: `Change order CO-${String(co.co_number).padStart(3, '0')} "${co.title}" created`,
      href: `/dashboard/projects/${id}/change-orders/${co.id}`,
    })),
    ...(quotes ?? []).map(q => ({
      at: q.created_at, label: `Quote v${q.version} created`,
      href: `/dashboard/projects/${id}/quotes/${q.id}`,
    })),
    ...(bids ?? []).map(b => ({
      at: b.created_at, label: `Bid v${b.version} created (${b.status})`,
      href: `/dashboard/bids/${b.id}`,
    })),
    ...(vendorQuotes ?? []).map(vq => ({
      at: vq.created_at, label: `Vendor quote logged: ${vq.vendor?.name ?? 'vendor'} — $${Number(vq.amount).toLocaleString()}`,
      href: undefined as string | undefined,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const approvedCOTotal = changeOrders?.filter(co => co.status === 'approved').reduce((sum, co) => sum + Number(co.total), 0) ?? 0
  const revisedValue = (Number(project.contract_value) || 0) + approvedCOTotal
  const acceptedBidTotal = bids?.filter(b => b.status === 'accepted').reduce((sum, b) => sum + Number(b.total), 0) ?? 0
  const vendorCostTotal = vendorQuotes?.reduce((sum, vq) => sum + Number(vq.amount), 0) ?? 0

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
          <p className="text-sm text-zinc-500 mt-1">
            Client: <span className="text-zinc-700">{project.client?.full_name ?? project.client?.email ?? 'Unassigned'}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <EditProjectButton project={project} clients={clients} />
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
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-zinc-500">Contract (revised)</p>
          <p className="text-lg font-bold text-zinc-900">${revisedValue.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-zinc-500">Accepted bids</p>
          <p className="text-lg font-bold text-zinc-900">${acceptedBidTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-zinc-500">Approved COs</p>
          <p className="text-lg font-bold text-green-700">+${approvedCOTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-zinc-500">Vendor costs logged</p>
          <p className="text-lg font-bold text-zinc-900">${vendorCostTotal.toLocaleString()}</p>
        </div>
      </div>

      <Tabs defaultValue="change-orders">
        <TabsList>
          <TabsTrigger value="change-orders">Change Orders ({changeOrders?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="quotes">Quotes ({quotes?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="bids">Bids ({bids?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Quotes ({vendorQuotes?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="team">Team ({team.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
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

        <TabsContent value="bids" className="mt-4 space-y-3">
          {!bids?.length ? (
            <p className="text-sm text-zinc-500">No bids yet. Generate one from a quote.</p>
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
                  {bids.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/bids/${b.id}`} className="font-medium text-zinc-900 hover:underline">
                          v{b.version}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 capitalize">
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">${Number(b.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="vendors" className="mt-4 space-y-3">
          {!vendorQuotes?.length ? (
            <p className="text-sm text-zinc-500">No vendor quotes logged for this project yet.</p>
          ) : (
            <div className="rounded-lg border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500">Vendor</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-zinc-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorQuotes.map((vq) => (
                    <tr key={vq.id} className="border-b last:border-0 hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {vq.vendor?.name ?? '—'}
                        {vq.vendor?.trade && <span className="text-zinc-400 font-normal"> · {vq.vendor.trade}</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{vq.description ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 capitalize">
                          {vq.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">${Number(vq.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <TeamPanel projectId={id} members={team} assignable={assignable} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {!activity.length ? (
            <p className="text-sm text-zinc-500">No activity yet.</p>
          ) : (
            <ol className="space-y-2">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
                  <div>
                    {a.href ? (
                      <Link href={a.href} className="text-zinc-900 hover:underline">{a.label}</Link>
                    ) : (
                      <span className="text-zinc-900">{a.label}</span>
                    )}
                    <span className="block text-xs text-zinc-400">
                      {new Date(a.at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
