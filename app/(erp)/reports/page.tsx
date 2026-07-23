'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatCurrency } from '@/lib/utils'
import { formatGBP, formatUKDate } from '@/lib/uk-locale'
import { Download } from 'lucide-react'

const REPORT_TYPES = [
  { value: 'sales', label: 'Sales Register' },
  { value: 'purchase', label: 'Purchase Register' },
  { value: 'inventory', label: 'Inventory Valuation' },
  { value: 'payroll', label: 'Payroll Summary' },
  { value: 'trial-balance', label: 'Trial Balance' },
  { value: 'receivables-aging', label: 'Receivables Aging' },
]

const RETAIL_REPORTS = [
  { value: 'fefo-expiry', label: 'FEFO Expiry Alert (30 days)' },
  { value: 'low-stock', label: 'Low Stock Replenishment' },
  { value: 'grn-discrepancy', label: 'GRN Discrepancy Report' },
  { value: 'daily-sales', label: 'Daily Sales Summary' },
  { value: 'supplier-performance', label: 'Supplier Delivery Performance' },
  { value: 'category-profitability', label: 'Category Profitability' },
  { value: 'customer-ltv', label: 'Customer LTV by Cohort' },
]

export default function ReportsPage() {
  const [reportType, setReportType] = useState('sales')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [retailReport, setRetailReport] = useState('fefo-expiry')
  const [retailDate, setRetailDate] = useState('')
  const [retailFrom, setRetailFrom] = useState('')
  const [retailTo, setRetailTo] = useState('')
  const [retailEnabled, setRetailEnabled] = useState(false)

  const { data: retailData, isLoading: retailLoading } = useQuery({
    queryKey: ['retail-report', retailReport, retailDate, retailFrom, retailTo],
    queryFn: () => {
      const p = new URLSearchParams({ report: retailReport })
      if (retailDate) p.set('date', retailDate)
      if (retailFrom) p.set('from', retailFrom)
      if (retailTo) p.set('to', retailTo)
      return api.get<unknown[]>(`/api/retail/reports?${p}`).then((r) => r.data ?? [])
    },
    enabled: retailEnabled,
  })

  function exportRetailCSV() {
    const rows = Array.isArray(retailData) ? retailData : []
    if (!rows.length) return
    const keys = Object.keys(rows[0] as Record<string, unknown>)
    const csv = [keys.join(','), ...(rows as Record<string, unknown>[]).map((row) => keys.map((k) => JSON.stringify(row[k] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${retailReport}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const { data, isLoading } = useQuery({
    queryKey: ['report', reportType, from, to],
    queryFn: () => api.get<unknown[]>('/api/reports', { type: reportType, from: from || undefined, to: to || undefined }).then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
    enabled,
  })

  function exportCSV() {
    if (!data || !Array.isArray(data) || data.length === 0) return
    const keys = Object.keys(data[0] as Record<string, unknown>)
    const csv = [keys.join(','), ...(data as Record<string, unknown>[]).map((row) => keys.map((k) => JSON.stringify(row[k] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportType}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getSalesColumns = () => [
    { key: 'invoiceNumber', header: 'Invoice #' },
    { key: 'customer.name', header: 'Customer', render: (r: Record<string, unknown>) => (r.customer as {name: string})?.name },
    { key: 'invoiceDate', header: 'Date', render: (r: Record<string, unknown>) => formatDate(r.invoiceDate as string) },
    { key: 'totalAmount', header: 'Amount', render: (r: Record<string, unknown>) => formatCurrency(Number(r.totalAmount)) },
    { key: 'status', header: 'Status' },
  ]

  const getPurchaseColumns = () => [
    { key: 'poNumber', header: 'PO #' },
    { key: 'vendor.name', header: 'Vendor', render: (r: Record<string, unknown>) => (r.vendor as {name: string})?.name },
    { key: 'orderDate', header: 'Date', render: (r: Record<string, unknown>) => formatDate(r.orderDate as string) },
    { key: 'grandTotal', header: 'Total', render: (r: Record<string, unknown>) => formatCurrency(Number(r.grandTotal)) },
    { key: 'status', header: 'Status' },
  ]

  const getInventoryColumns = () => [
    { key: 'sku', header: 'SKU' },
    { key: 'name', header: 'Item' },
    { key: 'category.name', header: 'Category', render: (r: Record<string, unknown>) => (r.category as {name: string})?.name },
    { key: 'totalQty', header: 'Qty' },
    { key: 'standardCost', header: 'Unit Cost', render: (r: Record<string, unknown>) => formatCurrency(Number(r.standardCost)) },
    { key: 'totalValue', header: 'Total Value', render: (r: Record<string, unknown>) => formatCurrency(Number(r.totalValue ?? 0)) },
  ]

  const getTrialBalanceColumns = () => [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Account' },
    { key: 'type', header: 'Type' },
    { key: 'totalDebit', header: 'Debit', render: (r: Record<string, unknown>) => formatCurrency(Number(r.totalDebit)) },
    { key: 'totalCredit', header: 'Credit', render: (r: Record<string, unknown>) => formatCurrency(Number(r.totalCredit)) },
  ]

  const getAgingColumns = () => [
    { key: 'invoiceNumber', header: 'Invoice #' },
    { key: 'customer.name', header: 'Customer', render: (r: Record<string, unknown>) => (r.customer as {name: string})?.name },
    { key: 'dueDate', header: 'Due Date', render: (r: Record<string, unknown>) => formatDate(r.dueDate as string) },
    { key: 'daysDue', header: 'Days Overdue' },
    { key: 'outstanding', header: 'Outstanding', render: (r: Record<string, unknown>) => formatCurrency(Number(r.outstanding)) },
    { key: 'bucket', header: 'Aging Bucket' },
  ]

  const getColumns = () => {
    switch (reportType) {
      case 'sales': return getSalesColumns()
      case 'purchase': return getPurchaseColumns()
      case 'inventory': return getInventoryColumns()
      case 'trial-balance': return getTrialBalanceColumns()
      case 'receivables-aging': return getAgingColumns()
      default: return []
    }
  }

  type Row = Record<string, unknown>

  const getRetailColumns = () => {
    if (retailReport === 'fefo-expiry') return [
      { key: 'batchNumber', label: 'Batch' },
      { key: 'product', label: 'Product', render: (row: Row) => (row.product as {productName: string})?.productName },
      { key: 'quantityOnHand', label: 'Qty' },
      { key: 'expiryDate', label: 'Expiry', render: (row: Row) => formatUKDate(row.expiryDate as string) },
    ]
    if (retailReport === 'low-stock') return [
      { key: 'sku', label: 'SKU' },
      { key: 'productName', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'reorderLevel', label: 'Reorder Level' },
      { key: 'totalQty', label: 'Current Stock' },
    ]
    if (retailReport === 'grn-discrepancy') return [
      { key: 'poId', label: 'PO #' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'productName', label: 'Product' },
      { key: 'ordered', label: 'Ordered' },
      { key: 'received', label: 'Received' },
      { key: 'variance', label: 'Variance', render: (row: Row) => <span className={(row.variance as number) < 0 ? 'text-red-600 font-bold' : 'text-green-600'}>{row.variance as number}</span> },
    ]
    if (retailReport === 'supplier-performance') return [
      { key: 'supplierName', label: 'Supplier' },
      { key: 'orderDate', label: 'Order Date', render: (row: Row) => formatUKDate(row.orderDate as string) },
      { key: 'expectedDelivery', label: 'Expected', render: (row: Row) => formatUKDate(row.expectedDelivery as string) },
      { key: 'actualDelivery', label: 'Actual', render: (row: Row) => formatUKDate(row.actualDelivery as string) },
      { key: 'varianceDays', label: 'Variance (days)', render: (row: Row) => <span className={(row.varianceDays as number) > 0 ? 'text-red-600' : 'text-green-600'}>{row.varianceDays as number}d</span> },
    ]
    if (retailReport === 'category-profitability') return [
      { key: 'category', label: 'Category' },
      { key: 'revenue', label: 'Revenue', render: (row: Row) => formatGBP(row.revenue as number) },
      { key: 'grossProfit', label: 'Gross Profit', render: (row: Row) => formatGBP(row.grossProfit as number) },
      { key: 'margin', label: 'Margin %', render: (row: Row) => `${(row.margin as number).toFixed(1)}%` },
    ]
    if (retailReport === 'customer-ltv') return [
      { key: 'name', label: 'Customer' },
      { key: 'cohort', label: 'Cohort' },
      { key: 'orderCount', label: 'Orders' },
      { key: 'ltv', label: 'LTV', render: (row: Row) => formatGBP(row.ltv as number) },
      { key: 'loyaltyPoints', label: 'Points' },
    ]
    return [{ key: 'id', label: 'ID' }]
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" description="Generate and export business reports" />

      <Card>
        <CardHeader><CardTitle>Report Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={(v) => { setReportType(v); setEnabled(false) }}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>From Date</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label>To Date</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <Button onClick={() => setEnabled(true)}>Generate Report</Button>
            <Button variant="outline" onClick={exportCSV} disabled={!data || (data as unknown[]).length === 0}>
              <Download className="mr-2 h-4 w-4" />Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {enabled && (
        <DataTable columns={getColumns()} data={((data ?? []) as Record<string, unknown>[])} loading={isLoading} />
      )}

      {/* Retail Reports */}
      <Card>
        <CardHeader><CardTitle>UK Retail Reports</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>Report</Label>
              <Select value={retailReport} onValueChange={(v) => { setRetailReport(v); setRetailEnabled(false) }}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RETAIL_REPORTS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {retailReport === 'daily-sales' && (
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={retailDate} onChange={(e) => setRetailDate(e.target.value)} className="w-40" />
              </div>
            )}
            {['grn-discrepancy', 'supplier-performance', 'category-profitability', 'customer-ltv'].includes(retailReport) && (
              <>
                <div className="space-y-1"><Label>From</Label><Input type="date" value={retailFrom} onChange={(e) => setRetailFrom(e.target.value)} className="w-40" /></div>
                <div className="space-y-1"><Label>To</Label><Input type="date" value={retailTo} onChange={(e) => setRetailTo(e.target.value)} className="w-40" /></div>
              </>
            )}
            <Button onClick={() => setRetailEnabled(true)}>Generate</Button>
            <Button variant="outline" onClick={exportRetailCSV} disabled={!retailData || !(retailData as unknown[]).length}>
              <Download className="mr-2 h-4 w-4" />Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {retailEnabled && (
        <DataTable columns={getRetailColumns()} data={((retailData ?? []) as Record<string, unknown>[])} loading={retailLoading} />
      )}
    </div>
  )
}
