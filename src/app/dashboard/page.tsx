import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FolderOpen, ClipboardList, FileText, AlertCircle, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

const coStatusColor: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  office_review: 'bg-purple-100 text-purple-700',
  sent_to_client: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-800',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [projectsRes, cosRes, quotesRes] = await Promise.all([
    supabase.from('projects').select('id, name, status, contract_value').order('created_at', { ascending: false }),
    supabase.from('change_orders').select('id, co_number, title, status, total, project_id, projects:project_id(name)').order('submitted_at', { ascending: false, nullsFirst: false }).limit(10),
    supabase.from('quotes').select('id, version, status, total, project_id').order('created_at', { ascending: false }),
  ])

  const projects = projectsRes.data as Array<{ id: string; name: string; status: string; contract_value: number | null }> | null
  const cos = cosRes.data as Array<{ id: string; co_number: number; title: string; status: string; total: number; project_id: string; projects: { name?: string } | null }> | null
  const quotes = quotesRes.data as Array<{ id: string; version: number; status: string; total: number; project_id: string }> | null

  const activeProjects = projects?.filter(p => p.status === 'active') ?? []
  const pendingCOs = cos?.filter(co => ['submitted', 'office_review', 'sent_to_client'].includes(co.status)) ?? []
  const openQuotes = quotes?.filter(q => ['draft', 'sent'].includes(q.status)) ?? []

  // Revenue: sum of (contract_value + approved COs) for active projects
  const approvedCOsByProject = cos?.filter(co => co.status === 'approved').reduce((acc, co) => {
    acc[co.project_id] = (acc[co.project_id] ?? 0) + Number(co.total)
    return acc
  }, {} as Record<string, number>) ?? {}

  const totalRevenue = activeProjects.reduce((sum, p) => {
    return sum + (Number(p.contract_value) || 0) + (approvedCOsByProject[p.id] ?? 0)
  }, 0)

  const pendingCOValue = pendingCOs.reduce((sum, co) => sum + Number(co.total), 0)
  const openQuoteValue = openQuotes.reduce((sum, q) => sum + Number(q.total), 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">{user?.email}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Active Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-900">{activeProjects.length}</p>
          </CardContent>
        </Card>

        <Card className={pendingCOs.length > 0 ? 'border-amber-300' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Pending COs</CardTitle>
            <AlertCircle className={`h-4 w-4 ${pendingCOs.length > 0 ? 'text-amber-500' : 'text-zinc-400'}`} />
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${pendingCOs.length > 0 ? 'text-amber-600' : 'text-zinc-900'}`}>{pendingCOs.length}</p>
            {pendingCOValue > 0 && <p className="text-xs text-zinc-500 mt-1">${pendingCOValue.toLocaleString()} pending</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Open Quotes</CardTitle>
            <FileText className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-900">{openQuotes.length}</p>
            {openQuoteValue > 0 && <p className="text-xs text-zinc-500 mt-1">${openQuoteValue.toLocaleString()} in pipeline</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Contract Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-zinc-900">${totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-zinc-500 mt-1">active projects</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending change orders */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-800">Needs Attention</h2>
            <Link href="/dashboard/change-orders" className="text-xs text-zinc-500 hover:underline">View all</Link>
          </div>
          {!pendingCOs.length ? (
            <p className="text-sm text-zinc-500 bg-white border rounded-lg p-4">No pending change orders.</p>
          ) : (
            <div className="rounded-lg border bg-white overflow-hidden">
              {pendingCOs.slice(0, 5).map(co => (
                <Link
                  key={co.id}
                  href={`/dashboard/projects/${co.project_id}/change-orders/${co.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{co.title}</p>
                    <p className="text-xs text-zinc-500">{co.projects?.name} · CO-{String(co.co_number).padStart(3, '0')}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${coStatusColor[co.status]}`}>
                      {co.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-medium text-zinc-700">${Number(co.total).toLocaleString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Active projects financial summary */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-800">Active Projects</h2>
            <Link href="/dashboard/projects" className="text-xs text-zinc-500 hover:underline">View all</Link>
          </div>
          {!activeProjects.length ? (
            <p className="text-sm text-zinc-500 bg-white border rounded-lg p-4">No active projects.</p>
          ) : (
            <div className="rounded-lg border bg-white overflow-hidden">
              {activeProjects.slice(0, 6).map(p => {
                const approvedCOs = approvedCOsByProject[p.id] ?? 0
                const revised = (Number(p.contract_value) || 0) + approvedCOs
                return (
                  <Link
                    key={p.id}
                    href={`/dashboard/projects/${p.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 border-b last:border-0"
                  >
                    <p className="text-sm font-medium text-zinc-900">{p.name}</p>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-medium text-zinc-900">${revised.toLocaleString()}</p>
                      {approvedCOs > 0 && (
                        <p className="text-xs text-green-600">+${approvedCOs.toLocaleString()} COs</p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
