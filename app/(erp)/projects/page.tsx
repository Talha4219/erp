import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Project = {
  id: string
  code: string
  name: string
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
  startDate: string
  endDate: string | null
  budget: number
  actualCost: number
  progress: number
  _count: { tasks: number }
}

export default async function ProjectsPage() {
  const initialData = await apiServer<Project[]>('/api/projects')
  return <PageClient initialData={initialData} />
}
