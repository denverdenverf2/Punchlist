'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { Pencil, Trash2 } from 'lucide-react'

type Vendor = {
  id: string; name: string; trade: string | null
  contact_name: string | null; email: string | null; phone: string | null; notes: string | null
}

export function VendorDetailActions({ vendor, hasQuotes }: { vendor: Vendor; hasQuotes: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: vendor.name,
    trade: vendor.trade ?? '',
    contact_name: vendor.contact_name ?? '',
    email: vendor.email ?? '',
    phone: vendor.phone ?? '',
    notes: vendor.notes ?? '',
  })

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: upErr } = await supabase.from('vendors').update({
      name: form.name,
      trade: form.trade || null,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      notes: form.notes || null,
    }).eq('id', vendor.id)
    if (upErr) { setError(upErr.message); setLoading(false); return }
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this vendor? This cannot be undone.')) return
    setDeleting(true)
    setError(null)
    const { error: delErr } = await supabase.from('vendors').delete().eq('id', vendor.id)
    if (delErr) { setError(delErr.message); setDeleting(false); return }
    router.push('/dashboard/vendors')
  }

  return (
    <div className="flex items-center gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={<Button size="sm" variant="outline"><Pencil className="h-4 w-4 mr-1" /> Edit</Button>}
        />
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Vendor</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Trade</Label>
              <Input value={form.trade} onChange={e => set('trade', e.target.value)} placeholder="electrician, plumber…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Contact</Label>
                <Input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={loading || !form.name}>{loading ? 'Saving…' : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Button
        size="sm"
        variant="outline"
        onClick={handleDelete}
        disabled={deleting || hasQuotes}
        title={hasQuotes ? 'Cannot delete a vendor with logged quotes' : 'Delete vendor'}
        className="text-red-600 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4 mr-1" /> Delete
      </Button>
    </div>
  )
}
