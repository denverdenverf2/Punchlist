import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClientApprovalActions } from './approval-actions'

export default async function PortalCOPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [coRes, lineItemsRes] = await Promise.all([
    supabase.from('change_orders').select('id, co_number, title, description, status, subtotal, markup_percent, total, project_id, projects:project_id(name, address)').eq('id', id).single(),
    supabase.from('change_order_line_items').select('id, description, quantity, unit, unit_cost, total').eq('change_order_id', id),
  ])

  const co = coRes.data as {
    id: string; co_number: number; title: string; description: string | null
    status: string; subtotal: number; markup_percent: number; total: number
    projects: { name?: string; address?: string } | null
  } | null
  const lineItems = lineItemsRes.data as Array<{
    id: string; description: string; quantity: number; unit: string; unit_cost: number; total: number
  }> | null

  if (!co || co.status !== 'sent_to_client') notFound()

  const project = co.projects

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">{project?.name} {project?.address ? `— ${project.address}` : ''}</p>
        <h1 className="text-2xl font-bold text-zinc-900 mt-1">{co.title}</h1>
        <p className="text-sm text-zinc-500">Change Order CO-{String(co.co_number).padStart(3, '0')}</p>
      </div>

      {co.description && (
        <Card>
          <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-zinc-700 whitespace-pre-wrap">{co.description}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Scope of Work</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2 font-medium text-zinc-500">Description</th>
                <th className="text-right py-2 font-medium text-zinc-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems?.map(item => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-right">${Number(item.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-right border-t pt-3">
            <p className="text-xl font-bold text-zinc-900">Total: ${Number(co.total).toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>

      <ClientApprovalActions coId={co.id} />
    </div>
  )
}
