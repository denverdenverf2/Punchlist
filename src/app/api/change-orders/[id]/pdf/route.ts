import { createServiceClient } from '@/lib/supabase/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { ChangeOrderPDF } from '@/lib/pdf/change-order-pdf'
import { NextResponse } from 'next/server'
import React, { type JSXElementConstructor, type ReactElement } from 'react'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServiceClient()

  const [coRes, lineItemsRes] = await Promise.all([
    supabase
      .from('change_orders')
      .select('*, projects:project_id(name, address, companies:company_id(name))')
      .eq('id', id)
      .single(),
    supabase
      .from('line_items')
      .select('description, quantity, unit, unit_cost, total, category')
      .eq('parent_type', 'change_order')
      .eq('parent_id', id),
  ])

  if (!coRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const co = coRes.data
  const project = co.projects as { name: string; address: string | null; companies: { name: string } | null } | null
  const companyName = project?.companies?.name ?? 'Your Company'

  const element = React.createElement(ChangeOrderPDF, {
    co,
    lineItems: lineItemsRes.data ?? [],
    project: { name: project?.name ?? '', address: project?.address ?? null },
    companyName,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

  const buffer = await renderToBuffer(element)

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="CO-${String(co.co_number).padStart(3, '0')}.pdf"`,
    },
  })
}
