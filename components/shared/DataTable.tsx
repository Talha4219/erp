'use client'

import React, { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle } from 'lucide-react'

export type Column<T extends object = Record<string, unknown>> = {
  key: string
  header?: string
  label?: string
  sortable?: boolean
  className?: string
  render?: (row: T) => React.ReactNode
}

type DataTableProps<T extends object> = {
  columns: Column<T>[]
  data: T[]
  pageSize?: number
  actions?: (row: T) => React.ReactNode
  isLoading?: boolean
  loading?: boolean
  error?: Error | null
  virtualized?: boolean
}

function VirtualizedRows<T extends object>({ columns, data, actions, getCellValue }: {
  columns: Column<T>[]
  data: T[]
  actions?: (row: T) => React.ReactNode
  getCellValue: (row: T, col: Column<T>) => React.ReactNode
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  })

  return (
    <div ref={parentRef} className="overflow-auto rounded-md border" style={{ height: '600px' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header ?? col.label}
                </TableHead>
              ))}
              {actions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="h-24 text-center text-muted-foreground">
                  No results found.
                </TableCell>
              </TableRow>
            ) : (
              virtualizer.getVirtualItems().map((virtualRow) => {
                const row = data[virtualRow.index]
                return (
                  <TableRow
                    key={virtualRow.key}
                    ref={virtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.key} className={cn(col.className)}>
                        {getCellValue(row, col)}
                      </TableCell>
                    ))}
                    {actions && <TableCell className="text-right">{actions(row)}</TableCell>}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function DataTable<T extends object>({
  columns,
  data,
  pageSize = 10,
  actions,
  isLoading = false,
  loading = false,
  error = null,
  virtualized = false,
}: DataTableProps<T>) {
  const effectiveLoading = isLoading || loading
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  if (error && !effectiveLoading) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-red-200 dark:border-red-900">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-sm font-medium text-red-600 dark:text-red-400">{error.message || 'Failed to load data'}</p>
      </div>
    )
  }

  if (effectiveLoading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-4">
          {[...Array(columns.length)].map((_, i) => (
            <Skeleton key={i} className="h-4 w-24" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  const asRecord = (row: T) => row as Record<string, unknown>

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = asRecord(a)[sortKey] ?? ''
        const bv = asRecord(b)[sortKey] ?? ''
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, pages)
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function getCellValue(row: T, col: Column<T>): React.ReactNode {
    if (col.render) return col.render(row)
    const key = col.key
    const val = key.split('.').reduce<unknown>((obj, k) => (obj as Record<string, unknown>)?.[k], asRecord(row))
    return val == null ? '-' : String(val)
  }

  if (virtualized) {
    return (
      <div className="space-y-4">
        <VirtualizedRows columns={columns} data={sorted} actions={actions} getCellValue={getCellValue} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.sortable ? (
                    <button
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.header ?? col.label}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  ) : (col.header ?? col.label)}
                </TableHead>
              ))}
              {actions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="h-24 text-center text-muted-foreground">
                  No results found.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn(col.className)}>
                      {getCellValue(row, col)}
                    </TableCell>
                  ))}
                  {actions && <TableCell className="text-right">{actions(row)}</TableCell>}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0 ? 'No records' : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={currentPage === 1}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => p - 1)} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">Page {currentPage} of {pages}</span>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => p + 1)} disabled={currentPage === pages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage(pages)} disabled={currentPage === pages}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}