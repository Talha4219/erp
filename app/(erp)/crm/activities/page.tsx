import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Activity = { id: string; type: string; subject: string; description: string | null; dueDate: string | null; completedAt: string | null; createdAt: string; lead: { firstName: string; lastName: string } | null; contact: { firstName: string; lastName: string } | null; opportunity: { title: string } | null }

export default async function ActivitiesPage() {
  const initialData = await apiServer<Activity[]>('/api/crm/activities')
  return <PageClient initialData={initialData} />
}
