import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { QuoteStatusActions } from './status-actions'
import { GenerateBidButton } from './bid-actions'
import Link from 'next/link'
import { Download, Pencil } from 'lucide-react'

const statusColor: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string; qid: string }>
}) {
  const { id: projectId, qid } = await params
  const supabase = await createClient()

  const [quoteRes, sectionsRes, bidsRes] = await Promise.all([
    supabase.from('quotes').select('*, projects:project_id(name)').eq('id', qid).single(),
    supabase.from('quote_sections').select('*, line_items(*)').eq('quote_id', qid).order('sort_order'),
    supabase.from('bids').select('id, version, status, total').eq('quote_id', qid).order('version'),
  ])

  const quote = quoteRes.data as {
    id: string; version: number; status: string; subtotal: number
    markup_percent: number; tax_rate: number; total: number; notes: string | null
    projects: { name: string } | null
  } | null

  const sections = sectionsRes.data as Array<{
    id: string; name: string; sort_order: number
    line_items: Array<{
      id: string; description: string; quantity: number; unit: string
      unit_cost: number; markup_percent: number; total: number
      cost_code: string | null; category: string
    }>
  }> | null

  const bids = bidsRes.data as Array<{ id: string; version: number; status: string; total: number }> | null

  if (!quote) notFound()

  const canEdit = quote.status === 'draft'

  const { data: profileRes } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', (await supabase.auth.getUser()).data.user!.id)
    .single()
  const userRole = (profileRes as { role?: string } | null)?.role ?? 'office'

  const categoryTotals = sections?.flatMap(s => s.line_items).reduce((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + Number(item.total)
    return acc
  }, {} as Record<string, number>) ?? {}

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{(quote.projects as { name?: string })?.name}</p>
          <h1 className="text-2xl font-bold text-zinc-900">Quote v{quote.version}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor[quote.status]}`}>
            {quote.status}
          </span>
          <a
            href={`/api/quotes/${qid}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Download className="h-4 w-4 mr-1" /> PDF
          </a>
          {canEdit && (
            <Link
              href={`/dashboard/projects/${projectId}/quotes/${qid}/edit`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Link>
          )}
          <GenerateBidButton quoteId={qid} projectId={projectId} quoteTotal={Number(quote.total)} hasBids={!!(bids && bids.length > 0)} />
        </div>
      </div>

      {/* Category breakdown */}
      {Object.keys(categoryTotals).length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Cost Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(categoryTotals).map(([cat, amt]) => (
                <div key={cat} className="text-center p-3 bg-zinc-50 rounded-lg">
                  <p className="text-xs text-zinc-500 capitalize">{cat}</p>
                  <p className="font-semibold text-zinc-900">${amt.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      {sections?.map(section => (
        <Card key={section.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{section.name}</CardTitle>
              <span className="text-sm font-medium text-zinc-700">
                ${section.line_items.reduce((s, i) => s + Number(i.total), 0).toFixed(2)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
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
                {section.line_items.map(item => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2">
                      {item.description}
                      <div className="flex gap-2 mt-0.5">
                        <span className="text-xs text-zinc-400 capitalize">{item.category}</span>
                        {item.cost_code && <span className="text-xs text-zinc-400">{item.cost_code}</span>}
                      </div>
                    </td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-center">{item.unit}</td>
                    <td className="py-2 text-right">${Number(item.unit_cost).toFixed(2)}</td>
                    <td className="py-2 text-right font-medium">${Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-right space-y-1 text-sm">
            <p className="text-zinc-500">Subtotal: <span className="font-medium text-zinc-800">${Number(quote.subtotal).toFixed(2)}</span></p>
            {quote.markup_percent > 0 && (
              <p className="text-zinc-500">Markup ({quote.markup_percent}%): <span className="font-medium text-zinc-800">
                ${(Number(quote.total) / (1 + Number(quote.tax_rate)) - Number(quote.subtotal)).toFixed(2)}
              </span></p>
            )}
            {quote.tax_rate > 0 && (
              <p className="text-zinc-500">Tax ({(Number(quote.tax_rate) * 100).toFixed(2)}%): <span className="font-medium text-zinc-800">
                ${(Number(quote.total) - Number(quote.total) / (1 + Number(quote.tax_rate))).toFixed(2)}
              </span></p>
            )}
            <p className="text-xl font-bold text-zinc-900 pt-2 border-t">Total: ${Number(quote.total).toFixed(2)}</p>
          </div>
          {quote.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-zinc-500 font-medium mb-1">Notes</p>
              <p className="text-sm text-zinc-700 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {bids && bids.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Bids from this quote</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {bids.map(b => (
              <Link
                key={b.id}
                href={`/dashboard/bids/${b.id}`}
                className="flex items-center justify-between text-sm hover:bg-zinc-50 rounded px-2 py-1.5 -mx-2"
              >
                <span className="font-medium text-zinc-900">Bid v{b.version}</span>
                <span className="flex items-center gap-3">
                  <span className="capitalize text-zinc-500">{b.status}</span>
                  <span className="font-medium tabular-nums">${Number(b.total).toFixed(2)}</span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <QuoteStatusActions quoteId={qid} currentStatus={quote.status} userRole={userRole} projectId={projectId} />
    </div>
  )
}
