'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PICKING', label: 'Picking' },
  { value: 'PACKING', label: 'Packing' },
  { value: 'READY', label: 'Ready' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const METHOD_OPTIONS = [
  { value: '', label: 'All Methods' },
  { value: 'COMPANY_DELIVERY', label: 'Company Delivery' },
  { value: 'CUSTOMER_PICKUP', label: 'Customer Pickup' },
  { value: 'CUSTOMER_TRANSPORT', label: 'Customer Transport' },
  { value: 'COURIER', label: 'Courier' },
  { value: 'INTERNAL_TRANSFER', label: 'Internal Transfer' },
]

type Filters = {
  search: string
  status: string
  method: string
  priority: string
}

type Props = {
  onFiltersChange: (filters: Filters) => void
  showStatus?: boolean
  showMethod?: boolean
  className?: string
}

export function FulfillmentFilters({ onFiltersChange, showStatus = true, showMethod = true, className }: Props) {
  const [filters, setFilters] = useState<Filters>({ search: '', status: '', method: '', priority: '' })

  const update = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value }
    setFilters(next)
    onFiltersChange(next)
  }

  const clear = () => {
    const next = { search: '', status: '', method: '', priority: '' }
    setFilters(next)
    onFiltersChange(next)
  }

  const hasFilters = filters.search || filters.status || filters.method || filters.priority

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search orders..."
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {showStatus && (
        <select
          value={filters.status}
          onChange={(e) => update('status', e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {showMethod && (
        <select
          value={filters.method}
          onChange={(e) => update('method', e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground"
        >
          {METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clear} className="h-9 text-xs gap-1">
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
