'use client'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, Plus, CreditCard, X, LayoutDashboard, GitCompareArrows } from 'lucide-react'
import Link from 'next/link'

type VI = {
  id: string; invoiceNumber: string; status: string; matchingStatus: string
  invoiceDate: string; dueDate: string; totalAmount: number; paidAmount: number
  vendor: { name: string }; po: { poNumber: string } | null
  department: { name: string } | null
}

const STATUS_VARIANT: Record<string, 'secondary'|'info'|'warning'|'success'|'destructive'> = {
  DRAFT: 'secondary', SENT: 'info', PARTIALLY_PAID: 'warning', PAID: 'success', OVERDUE: 'destructive', CANCELLED: 'secondary',
}
const MATCHING_CFG: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pending Review', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  MATCHED: { label: 'Matched', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MISMATCH: { label: 'Mismatch', cls: 'bg-red-50 text-red-600 border-red-200' },
}
const PAYMENT_STATUS_OPTS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
]

function MatchingPill({ status }: { status: string }) {
  const cfg = MATCHING_CFG[status] ?? MATCHING_CFG.PENDING
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', cfg.cls)}><GitCompareArrows className="h-2.5 w-2.5" />{cfg.label}</span>
}

function paymentStatusOf(inv: VI): 'unpaid' | 'partial' | 'paid' {
  if (inv.status === 'PAID') return 'paid'
  if (Number(inv.paidAmount) > 0) return 'partial'
  return 'unpaid'
}

export function PageClient({ initialData }: { initialData: VI[] }) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [filterMatching, setFilterMatching] = useState('')
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  const { data = [], isLoading, error } = useQuery({ queryKey: ['vendor-invoices'], queryFn: () => api.get<VI[]>('/api/procurement/vendor-invoices').then(r => r.data ?? []), initialData, staleTime: 30_000, placeholderData: (previousData) => previousData })

  const filtered = useMemo(() => data.filter(inv => {
    if (search) {
      const q = search.toLowerCase()
      if (!inv.invoiceNumber.toLowerCase().includes(q) && !inv.vendor.name.toLowerCase().includes(q)) return false
    }
    if (filterStatus && inv.status !== filterStatus) return false
    if (filterPayment && paymentStatusOf(inv) !== filterPayment) return false
    if (filterMatching && inv.matchingStatus !== filterMatching) return false
    if (dueFrom && new Date(inv.dueDate) < new Date(dueFrom)) return false
    if (dueTo && new Date(inv.dueDate) > new Date(dueTo)) return false
    if (minAmount && Number(inv.totalAmount) < Number(minAmount)) return false
    if (maxAmount && Number(inv.totalAmount) > Number(maxAmount)) return false
    return true
  }), [data, search, filterStatus, filterPayment, filterMatching, dueFrom, dueTo, minAmount, maxAmount])

  const hasFilters = search || filterStatus || filterPayment || filterMatching || dueFrom || dueTo || minAmount || maxAmount

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Invoices" description="Financial verification & payment control center" actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/procurement/purchase-invoices/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Link></Button>
          <Button size="sm" asChild><Link href="/procurement/purchase-invoices/new"><Plus className="mr-2 h-4 w-4" />New Invoice</Link></Button>
        </div>
      } />

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search invoice # or supplier…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-56 text-xs" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            {Object.keys(STATUS_VARIANT).map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Payment status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Payment</SelectItem>
            {PAYMENT_STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMatching} onValueChange={setFilterMatching}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Matching status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Matching</SelectItem>
            {Object.entries(MATCHING_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dueFrom} onChange={e => setDueFrom(e.target.value)} className="h-8 w-36 text-xs" title="Due from" />
        <span className="text-xs text-muted-foreground">–</span>
        <Input type="date" value={dueTo} onChange={e => setDueTo(e.target.value)} className="h-8 w-36 text-xs" title="Due to" />
        <Input type="number" placeholder="Min $" value={minAmount} onChange={e => setMinAmount(e.target.value)} className="h-8 w-24 text-xs" />
        <Input type="number" placeholder="Max $" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className="h-8 w-24 text-xs" />
        {hasFilters && (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
            setSearch(''); setFilterStatus(''); setFilterPayment(''); setFilterMatching(''); setDueFrom(''); setDueTo(''); setMinAmount(''); setMaxAmount('')
          }}>
            <X className="h-3.5 w-3.5 mr-1" />Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground/60">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <DataTable columns={[
        { key: 'invoiceNumber', header: 'Invoice #', sortable: true },
        { key: 'vendor', header: 'Supplier', render: (r: VI) => r.vendor.name },
        { key: 'po', header: 'PO Ref', render: (r: VI) => r.po?.poNumber ?? '—' },
        { key: 'invoiceDate', header: 'Invoice Date', render: (r: VI) => formatDate(r.invoiceDate) },
        { key: 'dueDate', header: 'Due Date', render: (r: VI) => {
          const days = Math.ceil((new Date(r.dueDate).getTime() - Date.now()) / 86400000)
          const unpaid = r.status !== 'PAID' && r.status !== 'CANCELLED'
          return <span className={cn(unpaid && days < 0 ? 'text-red-600 font-semibold' : unpaid && days <= 7 ? 'text-amber-600 font-medium' : '')}>{formatDate(r.dueDate)}</span>
        } },
        { key: 'totalAmount', header: 'Total', render: (r: VI) => formatCurrency(Number(r.totalAmount)) },
        { key: 'balance', header: 'Balance', render: (r: VI) => formatCurrency(Number(r.totalAmount) - Number(r.paidAmount)) },
        { key: 'matchingStatus', header: 'Matching', render: (r: VI) => <MatchingPill status={r.matchingStatus} /> },
        { key: 'status', header: 'Status', render: (r: VI) => <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>{r.status.replace(/_/g,' ')}</Badge> },
      ]} data={filtered} isLoading={isLoading} error={error}
        actions={(row: VI) => (
          <div className="flex items-center gap-1">
            {row.status !== 'PAID' && row.status !== 'CANCELLED' && Number(row.totalAmount) > Number(row.paidAmount) && (
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" asChild>
                <Link href={`/procurement/purchase-invoices/${row.id}`}>
                  <CreditCard className="mr-1 h-3 w-3" />Pay
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link href={`/procurement/purchase-invoices/${row.id}`}><Eye className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        )}
      />
    </div>
  )
}
