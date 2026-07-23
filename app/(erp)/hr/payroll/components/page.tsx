import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Component = { id: string; name: string; type: 'EARNING' | 'DEDUCTION'; calcMethod: 'FIXED' | 'PERCENTAGE_OF_BASIC'; value: number; isTaxable: boolean; isStatutory: boolean; isActive: boolean }

export default async function SalaryComponentsPage() {
  const initialData = await apiServer<Component[]>('/api/hr/salary-components')
  return <PageClient initialData={initialData} />
}
