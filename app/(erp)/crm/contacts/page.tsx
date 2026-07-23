import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Contact = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; mobile: string | null; jobTitle: string | null; department: string | null; customer: { name: string } | null }

export default async function ContactsPage() {
  const initialData = await apiServer<Contact[]>('/api/crm/contacts')
  return <PageClient initialData={initialData} />
}
