import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type PR = { id: string; returnNumber: string; status: string; returnDate: string; reason: string; totalAmount: number; vendor: { name: string }; grn: { grnNumber: string } | null; invoice: { invoiceNumber: string } | null }
type Vendor = { id: string; name: string }
type GRNListRow = { id: string; grnNumber: string; po: { vendor: { name: string } } }

export default async function ReturnsPage() {
  const [returns, vendors, grnsList] = await Promise.all([
    apiServer<PR[]>('/api/procurement/returns'),
    apiServer<Vendor[]>('/api/procurement/vendors'),
    apiServer<GRNListRow[]>('/api/procurement/grns'),
  ])
  return <PageClient initialReturns={returns} initialVendors={vendors} initialGrnsList={grnsList} />
}
