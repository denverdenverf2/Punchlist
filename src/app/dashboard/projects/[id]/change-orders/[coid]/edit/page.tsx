'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'

type LineItem = {
  description: string
  quantity: string
  unit: string
  unit_cost: string
  markup_percent: string
  category: string
  cost_code: string
}

// Only these statuses are editable; once it's gone to the client it's locked.
const EDITABLE_STATUSES = ['draft', 'submitted', 'office_review']

const emptyItem = (): LineItem => ({
  description: '', quantity: '1', unit: 'ea', unit_cost: '0',
  markup_percent: '0', category: 'labor', cost_code: '',
})

function itemTotal(item: LineItem) {
  const base = parseFloat(item.quantity || '0') * parseFloat(item.unit_cost || '0')
  return base * (1 + parseFloat(item.markup_percent || '0') / 100)
}

export default function EditChangeOrderPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const coid = params.coid as string
  const supabase = createClient()

  const [ready, setReady] = useState(false)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState('scope_change')
  const [markup, setMarkup] = useState('0')
  const [items, setItems] = useState<LineItem[]>([emptyItem()])

  useEffect(() => {
    async function load() {
      const [{ data: co }, { data: lines }] = await Promise.all([
        supabase.from('change_orders').select('*').eq('id', coid).single(),
        supabase.from('line_items').select('*').eq('parent_type', 'change_order').eq('parent_id', coid),
      ])
      if (!co) { setError('Change order not found'); setReady(true); return }
      if (!EDITABLE_STATUSES.includes(co.status)) { setLocked(true); setReady(true); return }

      setTitle(co.title)
      setDescription(co.description ?? '')
      setReason(co.reason)
      setMarkup(String(co.markup_percent))
      const loaded = (lines ?? []).map((l: Record<string, unknown>) => ({
        description: String(l.description ?? ''),
        quantity: String(l.quantity ?? '1'),
        unit: String(l.unit ?? 'ea'),
        unit_cost: String(l.unit_cost ?? '0'),
        markup_percent: String(l.markup_percent ?? '0'),
        category: String(l.category ?? 'labor'),
        cost_code: String(l.cost_code ?? ''),
      }))
      setItems(loaded.length ? loaded : [emptyItem()])
      setReady(true)
    }
    load()
  }, [supabase, coid])

  const subtotal = items.reduce((sum, item) => sum + itemTotal(item), 0)
  const total = subtotal * (1 + parseFloat(markup || '0') / 100)

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: coErr } = await supabase
      .from('change_orders')
      .update({
        title,
        description: description || null,
        reason: reason as 'scope_change' | 'unforeseen' | 'owner_request' | 'other',
        subtotal,
        markup_percent: parseFloat(markup),
        total,
      })
      .eq('id', coid)

    if (coErr) { setError(coErr.message); setLoading(false); return }

    // Replace line items wholesale (simpler + correct vs. diffing).
    await supabase.from('line_items').delete().eq('parent_type', 'change_order').eq('parent_id', coid)
    const lineItems = items.filter(i => i.description).map(i => ({
      parent_type: 'change_order',
      parent_id: coid,
      description: i.description,
      quantity: parseFloat(i.quantity),
      unit: i.unit,
      unit_cost: parseFloat(i.unit_cost),
      markup_percent: parseFloat(i.markup_percent),
      total: itemTotal(i),
      cost_code: i.cost_code || null,
      category: i.category as 'labor' | 'material' | 'equipment' | 'subcontractor',
    }))
    if (lineItems.length) await supabase.from('line_items').insert(lineItems)

    router.push(`/dashboard/projects/${projectId}/change-orders/${coid}`)
  }

  if (!ready) return <p className="text-sm text-zinc-500">Loading…</p>
  if (locked) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900">Change Order locked</h1>
        <p className="text-sm text-zinc-500">
          This change order has already been sent to the client (or finalized) and can no longer be edited.
        </p>
        <Button variant="outline" onClick={() => router.push(`/dashboard/projects/${projectId}/change-orders/${coid}`)}>
          Back to change order
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Edit Change Order</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={v => v && setReason(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scope_change">Scope Change</SelectItem>
                  <SelectItem value="unforeseen">Unforeseen Condition</SelectItem>
                  <SelectItem value="owner_request">Owner Request</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems(p => [...p, emptyItem()])}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3 bg-zinc-50">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="mt-6 text-zinc-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" step="0.01" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Input value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit Cost ($)</Label>
                    <Input type="number" step="0.01" value={item.unit_cost} onChange={e => updateItem(i, 'unit_cost', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Markup %</Label>
                    <Input type="number" step="0.1" value={item.markup_percent} onChange={e => updateItem(i, 'markup_percent', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <Select value={item.category} onValueChange={v => v && updateItem(i, 'category', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="labor">Labor</SelectItem>
                        <SelectItem value="material">Material</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="subcontractor">Subcontractor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cost Code</Label>
                    <Input value={item.cost_code} onChange={e => updateItem(i, 'cost_code', e.target.value)} placeholder="e.g. 03-100" />
                  </div>
                </div>
                <p className="text-xs text-right text-zinc-500">Item total: <span className="font-semibold text-zinc-800">${itemTotal(item).toFixed(2)}</span></p>
              </div>
            ))}

            <div className="flex items-center gap-4 justify-end pt-2 border-t">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Overall Markup %</Label>
                <Input type="number" step="0.1" value={markup} onChange={e => setMarkup(e.target.value)} className="w-20" />
              </div>
            </div>
            <div className="text-right space-y-1 text-sm">
              <p className="text-zinc-500">Subtotal: <span className="font-medium text-zinc-800">${subtotal.toFixed(2)}</span></p>
              <p className="text-zinc-900 font-bold text-base">Total: ${total.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
