import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Vendor = { id: string; name: string; paymentTerms: number; creditLimit: number | null; email: string | null }
type PO = { id: string; poNumber: string; vendorId: string; grandTotal: number; status: string }
type Item = { id: string; name: string; packing: string | null; sku: string }
type Account = { id: string; code: string; name: string }
type Warehouse = { id: string; name: string }
type Department = { id: string; name: string }
type CostCentre = { id: string; name: string; code: string }

export default async function NewPurchaseInvoicePage() {
  const [vendors, pos, items, accounts, warehouses, departments, costCentres] = await Promise.all([
    apiServer<Vendor[]>('/api/procurement/vendors'),
    apiServer<PO[]>('/api/procurement/purchase-orders'),
    apiServer<Item[]>('/api/inventory/items'),
    apiServer<Account[]>('/api/finance/accounts'),
    apiServer<Warehouse[]>('/api/inventory/warehouses'),
    apiServer<Department[]>('/api/hr/departments'),
    apiServer<CostCentre[]>('/api/finance/cost-centres'),
  ])
  return <PageClient vendors={vendors} pos={pos} items={items} accounts={accounts} warehouses={warehouses} departments={departments} costCentres={costCentres} />
}
