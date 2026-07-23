import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Account = {
  id: string
  code: string
  name: string
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  parent: { id: string; name: string } | null
  isSystem: boolean
  isActive: boolean
  children: Account[]
  description?: string
}

export default async function AccountsPage() {
  const initialData = await apiServer<Account[]>('/api/finance/accounts')
  return <PageClient initialData={initialData} />
}
