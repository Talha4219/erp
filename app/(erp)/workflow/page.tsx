import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Instance = { id: string; entityType: string; entityId: string; status: string; requestedAt: string; rejectionReason: string | null; definition: { name: string; module: string }; requester: { name: string | null; email: string }; actions: { action: string; actedAt: string }[] }

export default async function WorkflowPage() {
  const [initialPending, initialHistory] = await Promise.all([
    apiServer<Instance[]>('/api/workflow/instances?status=PENDING'),
    apiServer<Instance[]>('/api/workflow/instances?status=APPROVED'),
  ])
  return <PageClient initialPending={initialPending} initialHistory={initialHistory} />
}
