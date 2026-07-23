import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Template = { id: string; name: string; type: 'ONBOARDING' | 'OFFBOARDING'; isActive: boolean; tasks: Array<{ id?: string; title: string; description?: string; dueAfterDays: number; assignedRole: string; sortOrder: number }> }

export default async function OnboardingPage() {
  const initialData = await apiServer<Template[]>('/api/hr/onboarding')
  return <PageClient initialData={initialData} />
}
