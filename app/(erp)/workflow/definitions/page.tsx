import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Definition = { id: string; name: string; module: string; isActive: boolean; createdAt: string; steps: { id: string; stepOrder: number; name: string; approverRole: string | null }[]; _count: { instances: number } }

export default async function WorkflowDefinitionsPage() {
  const initialData = await apiServer<Definition[]>('/api/workflow/definitions')
  return <PageClient initialData={initialData} />
}
