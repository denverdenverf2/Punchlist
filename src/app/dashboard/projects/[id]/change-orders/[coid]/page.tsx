import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { COStatusActions } from './status-actions'
import { AttachmentManager } from './attachment-manager'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { Download, Pencil } from 'lucide-react'

const EDITABLE_STATUSES = ['draft', 'submitted', 'office_review']

const statusColor: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  submitted: 'bg-blue-100 text-blue-700',
  office_review: 'bg-purple-100 text-purple-700',
  sent_to_client: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  voided: 'bg-zinc-100 text-zinc-400',
}

const reasonLabel: Record<string, string> = {
  scope_change: 'Scope Change',
  unforeseen: 'Unforeseen Condition',
  owner_request: 'Owner Request',
  other: 'Other',
}

export default async function ChangeOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string; coid: string }>
}) {
  const { id: projectId, coid } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const profileRes = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const profile = profileRes.data as { role: string } | null

  const [coRes, lineItemsRes, attachmentsRes, commentsRes] = await Promise.all([
    supabase.from('change_orders').select('*').eq('id', coid).single(),
    supabase.from('line_items').select('*').eq('parent_type', 'change_order').eq('parent_id', coid),
    supabase.from('change_order_attachments').select('*').eq('change_order_id', coid),
    supabase.from('change_order_comments').select('id, body, created_at, user_id, profiles:user_id(full_name, email)').eq('change_order_id', coid).order('created_at'),
  ])

  const co = coRes.data as {
    id: string; co_number: number; title: string; description: string | null
    status: string; reason: string; subtotal: number; markup_percent: number; total: number
  } | null
  const lineItems = lineItemsRes.data as Array<{
    id: string; description: string; quantity: number; unit: string; unit_cost: number; total: number; category: string
  }> | null
  const attachments = attachmentsRes.data as Array<{ id: string; file_url: string; file_name: string }> | null
  const comments = commentsRes.data as Array<{
    id: string; body: string; created_at: string
    profiles: { full_name?: string; email?: string } | null
  }> | null

  if (!co) notFound()

  const canEdit = EDITABLE_STATUSES.includes(co.status)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 font-mono">CO-{String(co.co_number).padStart(3, '0')}</p>
          <h1 className="text-2xl font-bold text-zinc-900">{co.title}</h1>
          <p className="text-sm text-zinc-500 mt-1">{reasonLabel[co.reason]}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor[co.status]}`}>
            {co.status.replace(/_/g, ' ')}
          </span>
          <a
            href={`/api/change-orders/${coid}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Download className="h-4 w-4 mr-1" /> PDF
          </a>
          {canEdit && (
            <Link
              href={`/dashboard/projects/${projectId}/change-orders/${coid}/edit`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Link>
          )}
        </div>
      </div>

      {co.description && (
        <Card>
          <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-zinc-700 whitespace-pre-wrap">{co.description}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Line Items</CardTitle></CardHeader>
        <CardContent>
          {!lineItems?.length ? (
            <p className="text-sm text-zinc-500">No line items.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 font-medium text-zinc-500">Description</th>
                  <th className="text-center py-2 font-medium text-zinc-500">Qty</th>
                  <th className="text-center py-2 font-medium text-zinc-500">Unit</th>
                  <th className="text-right py-2 font-medium text-zinc-500">Unit Cost</th>
                  <th className="text-right py-2 font-medium text-zinc-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2">{item.description} <span className="text-xs text-zinc-400 ml-1">{item.category}</span></td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-center">{item.unit}</td>
                    <td className="py-2 text-right">${Number(item.unit_cost).toFixed(2)}</td>
                    <td className="py-2 text-right font-medium">${Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-4 text-right space-y-1 text-sm border-t pt-3">
            <p className="text-zinc-500">Subtotal: <span className="font-medium">${Number(co.subtotal).toFixed(2)}</span></p>
            {co.markup_percent > 0 && (
              <p className="text-zinc-500">Markup ({co.markup_percent}%): <span className="font-medium">${(Number(co.total) - Number(co.subtotal)).toFixed(2)}</span></p>
            )}
            <p className="text-base font-bold text-zinc-900">Total: ${Number(co.total).toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader>
        <CardContent>
          <AttachmentManager attachments={attachments ?? []} canEdit={canEdit} />
        </CardContent>
      </Card>

      <COStatusActions co={co} userRole={profile?.role ?? 'office'} projectId={projectId} />

      <Card>
        <CardHeader><CardTitle className="text-base">Comments</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {!comments?.length && <p className="text-sm text-zinc-500">No comments yet.</p>}
            {comments?.map(c => (
              <div key={c.id} className="text-sm">
                <p className="font-medium text-zinc-800">{c.profiles?.full_name ?? c.profiles?.email}</p>
                <p className="text-zinc-600">{c.body}</p>
                <p className="text-xs text-zinc-400">{new Date(c.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
