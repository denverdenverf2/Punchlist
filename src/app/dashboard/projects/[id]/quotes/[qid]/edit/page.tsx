'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { QuoteBuilderForm, emptyItem, type Section, type LineItem } from '../../quote-builder-form'

export default function EditQuotePage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const qid = params.qid as string
  const supabase = createClient()

  const [ready, setReady] = useState(false)
  const [locked, setLocked] = useState<string | null>(null)
  const [initial, setInitial] = useState<{
    notes: string; taxRate: string; globalMarkup: string; sections: Section[]
  } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: quote } = await supabase.from('quotes').select('*').eq('id', qid).single()
      if (!quote) { setLocked('Quote not found.'); setReady(true); return }
      if (quote.status !== 'draft') {
        setLocked('Only draft quotes can be edited. Generate a new bid revision to capture changes.')
        setReady(true); return
      }

      const { data: sectionRows } = await supabase
        .from('quote_sections')
        .select('id, name, sort_order, line_items(*, vendor_quotes:vendor_quote_id(vendor_id))')
        .eq('quote_id', qid)
        .order('sort_order')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sections: Section[] = ((sectionRows as any[]) ?? []).map(s => {
        const items: LineItem[] = (s.line_items ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((l: any) => ({
            description: String(l.description ?? ''),
            quantity: String(l.quantity ?? '1'),
            unit: String(l.unit ?? 'ea'),
            unit_cost: String(l.unit_cost ?? '0'),
            markup_percent: String(l.markup_percent ?? '0'),
            category: String(l.category ?? 'labor'),
            cost_code: String(l.cost_code ?? ''),
            vendor_id: l.vendor_quotes?.vendor_id ? String(l.vendor_quotes.vendor_id) : '',
          }))
        return { name: String(s.name), items: items.length ? items : [emptyItem()], open: true }
      })

      setInitial({
        notes: quote.notes ?? '',
        taxRate: String((Number(quote.tax_rate) || 0) * 100),
        globalMarkup: String(quote.markup_percent ?? '0'),
        sections: sections.length ? sections : [{ name: 'General', items: [emptyItem()], open: true }],
      })
      setReady(true)
    }
    load()
  }, [supabase, qid])

  if (!ready) return <p className="text-sm text-zinc-500">Loading…</p>
  if (locked) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900">Quote locked</h1>
        <p className="text-sm text-zinc-500">{locked}</p>
        <Button variant="outline" onClick={() => router.push(`/dashboard/projects/${projectId}/quotes/${qid}`)}>
          Back to quote
        </Button>
      </div>
    )
  }

  return <QuoteBuilderForm projectId={projectId} mode="edit" quoteId={qid} initial={initial!} />
}
