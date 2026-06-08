'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

export type LineItem = {
  description: string
  quantity: string
  unit: string
  unit_cost: string
  markup_percent: string
  category: string
  cost_code: string
  vendor_id: string // '' = no vendor; otherwise the sub whose quote this line marks up
}

export type Section = {
  name: string
  items: LineItem[]
  open: boolean
}

type Vendor = { id: string; name: string; trade: string | null }

export const emptyItem = (): LineItem => ({
  description: '', quantity: '1', unit: 'ea', unit_cost: '0',
  markup_percent: '0', category: 'labor', cost_code: '', vendor_id: '',
})

export function itemTotal(item: LineItem) {
  const base = parseFloat(item.quantity || '0') * parseFloat(item.unit_cost || '0')
  return base * (1 + parseFloat(item.markup_percent || '0') / 100)
}

export function QuoteBuilderForm({
  projectId,
  mode,
  quoteId,
  initial,
}: {
  projectId: string
  mode: 'new' | 'edit'
  quoteId?: string
  initial?: { notes: string; taxRate: string; globalMarkup: string; sections: Section[] }
}) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [taxRate, setTaxRate] = useState(initial?.taxRate ?? '0')
  const [globalMarkup, setGlobalMarkup] = useState(initial?.globalMarkup ?? '0')
  const [sections, setSections] = useState<Section[]>(
    initial?.sections ?? [{ name: 'General', items: [emptyItem()], open: true }]
  )
  const [vendors, setVendors] = useState<Vendor[]>([])

  useEffect(() => {
    supabase.from('vendors').select('id, name, trade').order('name')
      .then(({ data }) => setVendors((data as Vendor[]) ?? []))
  }, [supabase])

  const subtotal = sections.flatMap(s => s.items).reduce((sum, i) => sum + itemTotal(i), 0)
  const afterMarkup = subtotal * (1 + parseFloat(globalMarkup || '0') / 100)
  const tax = afterMarkup * parseFloat(taxRate || '0') / 100
  const total = afterMarkup + tax

  function updateItem(si: number, ii: number, field: keyof LineItem, value: string) {
    setSections(prev => prev.map((s, i) =>
      i !== si ? s : { ...s, items: s.items.map((item, j) => j !== ii ? item : { ...item, [field]: value }) }))
  }
  function addItem(si: number) {
    setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, items: [...s.items, emptyItem()] }))
  }
  function removeItem(si: number, ii: number) {
    setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, items: s.items.filter((_, j) => j !== ii) }))
  }
  function addSection() {
    setSections(prev => [...prev, { name: 'New Section', items: [emptyItem()], open: true }])
  }
  function removeSection(si: number) {
    setSections(prev => prev.filter((_, i) => i !== si))
  }
  function toggleSection(si: number) {
    setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, open: !s.open }))
  }
  function updateSectionName(si: number, name: string) {
    setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, name }))
  }

  // Write sections + line items for a given quote id (shared by new + edit).
  async function writeSections(targetQuoteId: string, userId: string) {
    for (let si = 0; si < sections.length; si++) {
      const section = sections[si]
      const { data: sec } = await supabase
        .from('quote_sections')
        .insert({ quote_id: targetQuoteId, name: section.name, sort_order: si })
        .select().single()
      if (!sec) continue

      const filled = section.items.filter(i => i.description)
      const lineItems = await Promise.all(filled.map(async (item, ii) => {
        let vendorQuoteId: string | null = null
        if (item.vendor_id) {
          const { data: vq } = await supabase.from('vendor_quotes').insert({
            vendor_id: item.vendor_id,
            project_id: projectId,
            description: item.description,
            amount: parseFloat(item.quantity || '0') * parseFloat(item.unit_cost || '0'),
            status: 'received',
            logged_by: userId,
          }).select('id').single()
          vendorQuoteId = (vq as { id?: string } | null)?.id ?? null
        }
        return {
          parent_type: 'quote',
          parent_id: targetQuoteId,
          section_id: sec.id,
          vendor_quote_id: vendorQuoteId,
          description: item.description,
          quantity: parseFloat(item.quantity),
          unit: item.unit,
          unit_cost: parseFloat(item.unit_cost),
          markup_percent: parseFloat(item.markup_percent),
          total: itemTotal(item),
          cost_code: item.cost_code || null,
          category: item.category,
          sort_order: ii,
        }
      }))
      if (lineItems.length) await supabase.from('line_items').insert(lineItems)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()

    if (mode === 'edit' && quoteId) {
      const { error: upErr } = await supabase.from('quotes').update({
        subtotal, tax_rate: parseFloat(taxRate) / 100,
        markup_percent: parseFloat(globalMarkup), total, notes: notes || null,
      }).eq('id', quoteId)
      if (upErr) { setError(upErr.message); setLoading(false); return }

      // Replace sections + lines wholesale.
      await supabase.from('line_items').delete().eq('parent_type', 'quote').eq('parent_id', quoteId)
      const { data: oldSections } = await supabase.from('quote_sections').select('id').eq('quote_id', quoteId)
      if (oldSections?.length) {
        await supabase.from('quote_sections').delete().eq('quote_id', quoteId)
      }
      await writeSections(quoteId, user!.id)
      router.push(`/dashboard/projects/${projectId}/quotes/${quoteId}`)
      return
    }

    // new
    const { data: existing } = await supabase.from('quotes').select('version')
      .eq('project_id', projectId).order('version', { ascending: false }).limit(1)
    const version = existing && existing.length > 0 ? existing[0].version + 1 : 1
    const { data: quote, error: qErr } = await supabase.from('quotes').insert({
      project_id: projectId, version, status: 'draft', subtotal,
      tax_rate: parseFloat(taxRate) / 100, markup_percent: parseFloat(globalMarkup),
      total, notes: notes || null, created_by: user!.id,
    }).select().single()
    if (qErr || !quote) { setError(qErr?.message ?? 'Failed to create quote'); setLoading(false); return }
    await writeSections(quote.id, user!.id)
    router.push(`/dashboard/projects/${projectId}/quotes/${quote.id}`)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{mode === 'edit' ? 'Edit Quote' : 'New Quote'}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {sections.map((section, si) => (
          <Card key={si}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => toggleSection(si)} className="text-zinc-400 hover:text-zinc-700">
                  {section.open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <Input
                  value={section.name}
                  onChange={e => updateSectionName(si, e.target.value)}
                  className="font-semibold text-base border-0 shadow-none p-0 h-auto focus-visible:ring-0"
                />
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-sm text-zinc-500">
                    ${section.items.reduce((s, i) => s + itemTotal(i), 0).toFixed(2)}
                  </span>
                  {sections.length > 1 && (
                    <button type="button" onClick={() => removeSection(si)} className="text-zinc-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>

            {section.open && (
              <CardContent className="space-y-3">
                {section.items.map((item, ii) => (
                  <div key={ii} className="border rounded-lg p-3 space-y-2 bg-zinc-50">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <Input
                          value={item.description}
                          onChange={e => updateItem(si, ii, 'description', e.target.value)}
                          placeholder="Description"
                        />
                      </div>
                      {section.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(si, ii)} className="mt-1 text-zinc-400 hover:text-red-500 shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" step="0.01" value={item.quantity} onChange={e => updateItem(si, ii, 'quantity', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Unit</Label>
                        <Input value={item.unit} onChange={e => updateItem(si, ii, 'unit', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Unit Cost ($)</Label>
                        <Input type="number" step="0.01" value={item.unit_cost} onChange={e => updateItem(si, ii, 'unit_cost', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Markup %</Label>
                        <Input type="number" step="0.1" value={item.markup_percent} onChange={e => updateItem(si, ii, 'markup_percent', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Category</Label>
                        <Select value={item.category} onValueChange={v => v && updateItem(si, ii, 'category', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="labor">Labor</SelectItem>
                            <SelectItem value="material">Material</SelectItem>
                            <SelectItem value="equipment">Equipment</SelectItem>
                            <SelectItem value="subcontractor">Sub</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Cost Code</Label>
                        <Input value={item.cost_code} onChange={e => updateItem(si, ii, 'cost_code', e.target.value)} placeholder="e.g. 03-100" />
                      </div>
                      <div>
                        <Label className="text-xs">Vendor (sub)</Label>
                        <Select
                          value={item.vendor_id || 'none'}
                          onValueChange={v => {
                            if (!v) return
                            const vendorId = v === 'none' ? '' : v
                            updateItem(si, ii, 'vendor_id', vendorId)
                            if (vendorId) updateItem(si, ii, 'category', 'subcontractor')
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {vendors.map(v => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name}{v.trade ? ` · ${v.trade}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-right text-zinc-500 shrink-0">
                      {item.vendor_id && <span className="mr-2 text-zinc-400">Unit cost = vendor&apos;s quoted amount</span>}
                      Total: <span className="font-semibold text-zinc-800">${itemTotal(item).toFixed(2)}</span>
                    </p>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => addItem(si)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </CardContent>
            )}
          </Card>
        ))}

        <Button type="button" variant="outline" onClick={addSection} className="w-full border-dashed">
          <Plus className="h-4 w-4 mr-1" /> Add Section
        </Button>

        <Card>
          <CardHeader><CardTitle>Totals & Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Global Markup %</Label>
                <Input type="number" step="0.1" value={globalMarkup} onChange={e => setGlobalMarkup(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Tax Rate %</Label>
                <Input type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} />
              </div>
            </div>
            <div className="text-right space-y-1 text-sm border-t pt-3">
              <p className="text-zinc-500">Subtotal: <span className="font-medium text-zinc-800">${subtotal.toFixed(2)}</span></p>
              {parseFloat(globalMarkup) > 0 && (
                <p className="text-zinc-500">After markup: <span className="font-medium text-zinc-800">${afterMarkup.toFixed(2)}</span></p>
              )}
              {parseFloat(taxRate) > 0 && (
                <p className="text-zinc-500">Tax ({taxRate}%): <span className="font-medium text-zinc-800">${tax.toFixed(2)}</span></p>
              )}
              <p className="text-base font-bold text-zinc-900">Total: ${total.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Terms, payment schedule, exclusions…" rows={3} />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>{loading ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Save Quote'}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
