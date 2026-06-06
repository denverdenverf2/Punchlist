'use client'

import { useState } from 'react'
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

const emptyItem = (): LineItem => ({
  description: '',
  quantity: '1',
  unit: 'ea',
  unit_cost: '0',
  markup_percent: '0',
  category: 'labor',
  cost_code: '',
})

function itemTotal(item: LineItem) {
  const base = parseFloat(item.quantity || '0') * parseFloat(item.unit_cost || '0')
  return base * (1 + parseFloat(item.markup_percent || '0') / 100)
}

export default function NewChangeOrderPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState('scope_change')
  const [markup, setMarkup] = useState('0')
  const [items, setItems] = useState<LineItem[]>([emptyItem()])
  const [files, setFiles] = useState<File[]>([])

  const subtotal = items.reduce((sum, item) => sum + itemTotal(item), 0)
  const total = subtotal * (1 + parseFloat(markup || '0') / 100)

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()

    // Get next CO number
    const { data: coNumberData } = await supabase.rpc('next_co_number', { p_project_id: projectId })

    const { data: co, error: coError } = await supabase
      .from('change_orders')
      .insert({
        project_id: projectId,
        co_number: coNumberData,
        title,
        description: description || null,
        reason: reason as 'scope_change' | 'unforeseen' | 'owner_request' | 'other',
        status: 'submitted',
        submitted_by: user!.id,
        submitted_at: new Date().toISOString(),
        subtotal,
        markup_percent: parseFloat(markup),
        total,
      })
      .select()
      .single()

    if (coError) { setError(coError.message); setLoading(false); return }

    // Insert line items
    if (items.some(i => i.description)) {
      const lineItems = items
        .filter(i => i.description)
        .map(i => ({
          change_order_id: co.id,
          description: i.description,
          quantity: parseFloat(i.quantity),
          unit: i.unit,
          unit_cost: parseFloat(i.unit_cost),
          markup_percent: parseFloat(i.markup_percent),
          total: itemTotal(i),
          cost_code: i.cost_code || null,
          category: i.category as 'labor' | 'material' | 'equipment' | 'subcontractor',
        }))

      await supabase.from('change_order_line_items').insert(lineItems)
    }

    // Upload attachments
    for (const file of files) {
      const path = `${co.id}/${Date.now()}-${file.name}`
      const { data: upload } = await supabase.storage.from('attachments').upload(path, file)
      if (upload) {
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path)
        await supabase.from('change_order_attachments').insert({
          change_order_id: co.id,
          file_url: publicUrl,
          file_name: file.name,
          uploaded_by: user!.id,
        })
      }
    }

    router.push(`/dashboard/projects/${projectId}/change-orders/${co.id}`)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">New Change Order</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief description of the change" required />
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
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Explain what changed and why…" rows={3} />
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
                    <Input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="What work / material?" />
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
                    <Input value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} placeholder="ea, hr, ft…" />
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

        <Card>
          <CardHeader><CardTitle>Photos / Attachments</CardTitle></CardHeader>
          <CardContent>
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={e => setFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
            />
            {files.length > 0 && (
              <ul className="mt-2 text-xs text-zinc-500 space-y-0.5">
                {files.map(f => <li key={f.name}>{f.name}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="flex-1 sm:flex-none">
            {loading ? 'Submitting…' : 'Submit Change Order'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
