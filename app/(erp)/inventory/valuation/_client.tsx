'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'

type ValuationRow = {
  warehouseId: string
  warehouseName: string
  itemId: string
  sku: string
  itemName: string
  uom: string
  quantity: number
  avgCost: number
  standardCost: number
  unitCost: number
  totalValue: number
  method: string
}

type ValuationResult = {
  valuation: ValuationRow[]
  totalStockValue: number
  method: string
}

type Warehouse = { id: string; name: string }

export function PageClient({ initialData }: { initialData: ValuationResult }) {
  const [method, setMethod] = useState('moving_average')
  const [warehouseId, setWarehouseId] = useState('')

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get<Warehouse[]>('/api/inventory/warehouses').then((r) => r.data ?? []),
  })

  const params = new URLSearchParams({ method })
  if (warehouseId) params.set('warehouseId', warehouseId)

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock-valuation', method, warehouseId],
    queryFn: () => api.get<ValuationResult>(`/api/inventory/valuation?${params}`).then((r) => r.data),
    initialData: method === 'moving_average' && !warehouseId ? initialData : undefined,
    staleTime: method === 'moving_average' && !warehouseId ? 30_000 : 0,
  })

  const valuation = data?.valuation ?? []
  const totalStockValue = data?.totalStockValue ?? 0

  const columns = [
    { key: 'warehouseName', header: 'Warehouse', sortable: true },
    { key: 'sku', header: 'SKU', sortable: true },
    { key: 'itemName', header: 'Item Name', sortable: true },
    { key: 'uom', header: 'UOM' },
    { key: 'quantity', header: 'Qty on Hand', render: (r: ValuationRow) => Number(r.quantity).toFixed(3) },
    { key: 'avgCost', header: 'Avg Cost', render: (r: ValuationRow) => formatCurrency(r.avgCost) },
    { key: 'standardCost', header: 'Std Cost', render: (r: ValuationRow) => formatCurrency(r.standardCost) },
    { key: 'unitCost', header: 'Valuation Cost', render: (r: ValuationRow) => formatCurrency(r.unitCost) },
    {
      key: 'totalValue', header: 'Total Value',
      render: (r: ValuationRow) => <span className="font-semibold">{formatCurrency(r.totalValue)}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Valuation"
        description="Real-time stock value by warehouse using moving average or standard cost"
      />

      <div className="flex gap-3 flex-wrap items-center">
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="moving_average">Moving Average Cost</SelectItem>
            <SelectItem value="fifo">Standard Cost (FIFO proxy)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Warehouses</SelectItem>
            {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Badge variant="outline" className="text-sm px-3 py-1">
          Method: {method === 'moving_average' ? 'Moving Average' : 'Standard Cost'}
        </Badge>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Stock Value</p>
              <p className="text-3xl font-bold">{formatCurrency(totalStockValue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={valuation}
        isLoading={isLoading} error={error}
      />
    </div>
  )
}
