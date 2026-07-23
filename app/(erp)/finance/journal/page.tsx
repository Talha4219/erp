import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type JournalEntry = { id: string; entryNumber: string; date: string; description: string; status: 'DRAFT' | 'POSTED' | 'REVERSED'; reference: string | null; createdBy: { name: string | null } | null }

export default async function JournalPage() {
  const initialData = await apiServer<JournalEntry[]>('/api/finance/journal')
  return <PageClient initialData={initialData} />
}
