'use client'

import { useParams } from 'next/navigation'
import { QuoteBuilderForm } from '../quote-builder-form'

export default function NewQuotePage() {
  const params = useParams()
  const projectId = params.id as string
  return <QuoteBuilderForm projectId={projectId} mode="new" />
}
