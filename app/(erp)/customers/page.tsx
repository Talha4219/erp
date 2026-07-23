import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type RetailCustomer = { id: number; title: string | null; firstName: string; lastName: string; email: string; phone: string | null; loyaltyPointsBalance: number; marketingOptIn: boolean; gdprConsentDate: string | null; dataRetentionConsent: boolean; isAnonymised: boolean; createdAt: string; addresses: Array<{ id: number; addressLine1: string; city: string; postcode: string; isPrimary: boolean }> }

export default async function CustomersPage() {
  const initialData = await apiServer<RetailCustomer[]>('/api/retail/customers')
  return <PageClient initialData={initialData} />
}
