import { createServiceClient } from '@/lib/supabase/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { QuotePDF } from '@/lib/pdf/quote-pdf'
import { NextResponse } from 'next/server'
import React, { type JSXElementConstructor, type ReactElement } from 'react'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServiceClient()

  const [quoteRes, sectionsRes] = await Promise.all([
    supabase
      .from('quotes')
      .select('*, projects:project_id(name, address, companies:company_id(name))')
      .eq('id', id)
      .single(),
    supabase
      .from('quote_sections')
      .select('name, sort_order, line_items(description, quantity, unit, unit_cost, markup_percent, total, cost_code, category, sort_order)')
      .eq('quote_id', id)
      .order('sort_order'),
  ])

  if (!quoteRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const quote = quoteRes.data
  const project = quote.projects as { name: string; address: string | null; companies: { name: string } | null } | null
  const companyName = project?.companies?.name ?? 'Your Company'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections = (sectionsRes.data ?? []).map((s: any) => ({
    name: s.name as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: s.line_items as any[],
  }))

  const element = React.createElement(QuotePDF, {
    quote,
    sections,
    projectName: project?.name ?? '',
    projectAddress: project?.address ?? null,
    companyName,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

  const buffer = await renderToBuffer(element)

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Quote-v${quote.version}.pdf"`,
    },
  })
}
