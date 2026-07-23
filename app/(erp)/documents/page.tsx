import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Doc = { id: string; title: string; category: string; entityType: string | null; entityId: string | null; fileUrl: string; fileName: string; fileSize: number | null; mimeType: string | null; tags: string[]; expiryDate: string | null; notes: string | null; createdAt: string; uploadedById: string }

export default async function DocumentsPage() {
  const initialData = await apiServer<Doc[]>('/api/documents')
  return <PageClient initialData={initialData} />
}
