import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FolderOpen, ClipboardList, FileText, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ count: projectCount }, { count: pendingCOs }, { count: openQuotes }] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('change_orders').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'office_review']),
    supabase.from('quotes').select('*', { count: 'exact', head: true }).in('status', ['draft', 'sent']),
  ])

  const stats = [
    { label: 'Active Projects', value: projectCount ?? 0, icon: FolderOpen, href: '/dashboard/projects' },
    { label: 'Pending Change Orders', value: pendingCOs ?? 0, icon: AlertCircle, href: '/dashboard/change-orders', highlight: (pendingCOs ?? 0) > 0 },
    { label: 'Open Quotes', value: openQuotes ?? 0, icon: FileText, href: '/dashboard/quotes' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Welcome back{user?.email ? `, ${user.email}` : ''}.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, href, highlight }) => (
          <Link key={label} href={href}>
            <Card className={`hover:shadow-md transition-shadow cursor-pointer ${highlight ? 'border-amber-400' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">{label}</CardTitle>
                <Icon className={`h-4 w-4 ${highlight ? 'text-amber-500' : 'text-zinc-400'}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${highlight ? 'text-amber-600' : 'text-zinc-900'}`}>{value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
