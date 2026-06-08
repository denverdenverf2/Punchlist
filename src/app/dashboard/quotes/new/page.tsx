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

type LineItem = {
  description: string
  quantity: string
  unit: string
  unit_cost: string
  markup_percent: string
  category: string
  cost_code: string
}

type Section = { name: string; items: LineItem[]; open: boolean }
type Project = { id: string; name: string }

const emptyItem = (): LineItem => ({
  description: '', quantity: '1', unit: 'ea', unit_cost: '0',
  markup_percent: '0', category: 'labor', cost_code: '',
})

function itemTotal(item: LineItem) {
  const base = parseFloat(item.quantity || '0') * parseFloat(item.unit_cost || '0')
  return base * (1 + parseFloat(item.markup_percent || '0') / 100)
}

export default function NewQuoteStandalonePage() {
  const router = useRouter()
  const supabase = createClient()

  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [globalMarkup, setGlobalMarkup] = useState('0')
  const [sections, setSections] = useState<Section[]>([{ name: 'General', items: [emptyItem()], open: true }])

  useEffect(() => {
    supabase.from('projects').select('id, name').order('name').then(({ data }) => {
      setProjects(data ?? [])
      if (data?.length) setProjectId(data[0].id)
    })
  }, [])

  const subtotal = sections.flatMap(s => s.items).reduce((sum, i) => sum + itemTotal(i), 0)
  const afterMarkup = subtotal * (1 + parseFloat(globalMarkup || '0') / 100)
  const tax = afterMarkup * parseFloat(taxRate || '0') / 100
  const total = afterMarkup + tax

  function updateItem(si: number, ii: number, field: keyof LineItem, value: string) {
    setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, items: s.items.map((item, j) => j !== ii ? item : { ...item, [field]: value }) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId) { setError('Please select a project'); return }
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: existing } = await supabase.from('quotes').select('version').eq('project_id', projectId).order('version', { ascending: false }).limit(1)
    const version = existing?.length ? existing[0].version + 1 : 1

    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .insert({ project_id: projectId, version, status: 'draft', subtotal, tax_rate: parseFloat(taxRate) / 100, markup_percent: parseFloat(globalMarkup), total, notes: notes || null, created_by: user!.id })
      .select().single()

    if (qErr || !quote) { setError(qErr?.message ?? 'Failed'); setLoading(false); return }

    for (let si = 0; si < sections.length; si++) {
      const section = sections[si]
      const { data: sec } = await supabase.from('quote_sections').insert({ quote_id: quote.id, name: section.name, sort_order: si }).select().single()
      if (!sec) continue
      const lineItems = section.items.filter(i => i.description).map((item, ii) => ({
        parent_type: 'quote', parent_id: quote.id,
        section_id: sec.id, description: item.description, quantity: parseFloat(item.quantity),
        unit: item.unit, unit_cost: parseFloat(item.unit_cost), markup_percent: parseFloat(item.markup_percent),
        total: itemTotal(item), cost_code: item.cost_code || null, category: item.category, sort_order: ii,
      }))
      if (lineItems.length) await supabase.from('line_items').insert(lineItems)
    }

    router.push(`/dashboard/projects/${projectId}/quotes/${quote.id}`)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">New Quote</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Project</CardTitle></CardHeader>
          <CardContent>
            <Select value={projectId} onValueChange={v => v && setProjectId(v)}>
              <SelectTrigger><SelectValue placeholder="Select a project…" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {sections.map((section, si) => (
          <Card key={si}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, open: !s.open }))} className="text-zinc-400 hover:text-zinc-700">
                  {section.open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <Input value={section.name} onChange={e => setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, name: e.target.value }))}
                  className="font-semibold text-base border-0 shadow-none p-0 h-auto focus-visible:ring-0" />
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-sm text-zinc-500">${section.items.reduce((s, i) => s + itemTotal(i), 0).toFixed(2)}</span>
                  {sections.length > 1 && (
                    <button type="button" onClick={() => setSections(prev => prev.filter((_, i) => i !== si))} className="text-zinc-400 hover:text-red-500">
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
                    <div className="flex gap-2">
                      <Input className="flex-1" value={item.description} onChange={e => updateItem(si, ii, 'description', e.target.value)} placeholder="Description" />
                      {section.items.length > 1 && (
                        <button type="button" onClick={() => setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, items: s.items.filter((_, j) => j !== ii) }))} className="text-zinc-400 hover:text-red-500 shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div><Label className="text-xs">Qty</Label><Input type="number" step="0.01" value={item.quantity} onChange={e => updateItem(si, ii, 'quantity', e.target.value)} /></div>
                      <div><Label className="text-xs">Unit</Label><Input value={item.unit} onChange={e => updateItem(si, ii, 'unit', e.target.value)} /></div>
                      <div><Label className="text-xs">Unit Cost ($)</Label><Input type="number" step="0.01" value={item.unit_cost} onChange={e => updateItem(si, ii, 'unit_cost', e.target.value)} /></div>
                      <div><Label className="text-xs">Markup %</Label><Input type="number" step="0.1" value={item.markup_percent} onChange={e => updateItem(si, ii, 'markup_percent', e.target.value)} /></div>
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
                    <div className="flex gap-2 items-center">
                      <div className="flex-1"><Label className="text-xs">Cost Code</Label><Input value={item.cost_code} onChange={e => updateItem(si, ii, 'cost_code', e.target.value)} placeholder="e.g. 03-100" /></div>
                      <p className="text-xs text-right text-zinc-500 mt-4 shrink-0">Total: <span className="font-semibold">${itemTotal(item).toFixed(2)}</span></p>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, items: [...s.items, emptyItem()] }))}>
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </CardContent>
            )}
          </Card>
        ))}

        <Button type="button" variant="outline" onClick={() => setSections(prev => [...prev, { name: 'New Section', items: [emptyItem()], open: true }])} className="w-full border-dashed">
          <Plus className="h-4 w-4 mr-1" /> Add Section
        </Button>

        <Card>
          <CardHeader><CardTitle>Totals & Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Global Markup %</Label><Input type="number" step="0.1" value={globalMarkup} onChange={e => setGlobalMarkup(e.target.value)} /></div>
              <div className="space-y-1"><Label>Tax Rate %</Label><Input type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} /></div>
            </div>
            <div className="text-right space-y-1 text-sm border-t pt-3">
              <p className="text-zinc-500">Subtotal: <span className="font-medium">${subtotal.toFixed(2)}</span></p>
              {parseFloat(globalMarkup) > 0 && <p className="text-zinc-500">After markup: <span className="font-medium">${afterMarkup.toFixed(2)}</span></p>}
              {parseFloat(taxRate) > 0 && <p className="text-zinc-500">Tax: <span className="font-medium">${tax.toFixed(2)}</span></p>}
              <p className="text-base font-bold text-zinc-900">Total: ${total.toFixed(2)}</p>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Terms, payment schedule, exclusions…" rows={3} /></div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save Quote'}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
