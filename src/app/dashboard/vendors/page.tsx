import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AddVendorButton } from './vendor-actions'

export default async function VendorsPage() {
  const supabase = await createClient()

  const { data: vendorsRaw } = await supabase
    .from('vendors')
    .select('id, name, trade, contact_name, email, phone')
    .order('name')

  const vendors = vendorsRaw as Array<{
    id: string; name: string; trade: string | null
    contact_name: string | null; email: string | null; phone: string | null
  }> | null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Vendors</h1>
        <AddVendorButton />
      </div>

      {!vendors?.length ? (
        <p className="text-sm text-zinc-500">
          No vendors yet. Subs and third parties (painters, electricians, plumbers)
          will be managed here.
        </p>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Trade</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Contact</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <Link href={`/dashboard/vendors/${v.id}`} className="hover:underline">{v.name}</Link>
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-600">{v.trade ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {v.contact_name ?? v.email ?? v.phone ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
