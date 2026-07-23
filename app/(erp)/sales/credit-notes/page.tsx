import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type CN = { id: string; creditNoteNumber: string; status: string; issueDate: string; amount: number; appliedAmount: number; reason: string | null; customer: { name: string }; return: { returnNumber: string } | null }

export default async function CreditNotesPage() {
  const initialData = await apiServer<CN[]>('/api/sales/credit-notes')
  return <PageClient initialData={initialData} />
}
