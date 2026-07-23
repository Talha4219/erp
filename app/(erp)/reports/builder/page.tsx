'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Play, Save, Download, Plus, Trash2, BookOpen, ChevronRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

type ColumnDef = { key: string; label: string; type: 'string' | 'number' | 'date' | 'boolean' }
type DataSource = { label: string; columns: ColumnDef[] }
type DataSources = Record<string, DataSource>

type Filter = { field: string; op: string; value: string }
type SavedReport = {
  id: string; name: string; description?: string; module: string
  columns: string[]; filters: Filter[]; createdAt: string; isShared: boolean
}

const FILTER_OPS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'gte', label: 'from (date)' },
  { value: 'lte', label: 'to (date)' },
]

function csvExport(rows: Record<string, unknown>[], cols: string[]) {
  const header = cols.join(',')
  const lines = rows.map((r) =>
    cols.map((c) => {
      const v = c.split('.').reduce((a: unknown, k) => (a && typeof a === 'object' ? (a as Record<string, unknown>)[k] : undefined), r as unknown)
      return `"${String(v ?? '').replace(/"/g, '""')}"`
    }).join(',')
  )
  const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'report.csv'; a.click()
  URL.revokeObjectURL(url)
}

function formatCell(value: unknown, type: string) {
  if (value === null || value === undefined) return <span className="text-gray-400">—</span>
  if (type === 'number') return <span className="font-mono">{formatCurrency(Number(value))}</span>
  if (type === 'date') return <span>{formatDate(String(value))}</span>
  if (type === 'boolean') return <Badge variant={value ? 'default' : 'secondary'}>{value ? 'Yes' : 'No'}</Badge>
  return String(value)
}

export default function ReportBuilderPage() {
  const [source, setSource] = useState<string>('')
  const [selectedCols, setSelectedCols] = useState<string[]>([])
  const [filters, setFilters] = useState<Filter[]>([])
  const [sortBy, setSortBy] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [reportName, setReportName] = useState('')
  const [reportDesc, setReportDesc] = useState('')
  const [savedView, setSavedView] = useState(false)

  const { data: sourcesData } = useQuery<{ data: DataSources }>({
    queryKey: ['report-sources'],
    queryFn: () => fetch('/api/reports/builder?action=sources').then((r) => r.json()),
  })
  const sources = useMemo(() => sourcesData?.data ?? {}, [sourcesData])

  const { data: savedData, refetch: refetchSaved } = useQuery<{ data: SavedReport[] }>({
    queryKey: ['saved-reports'],
    queryFn: () => fetch('/api/reports/builder').then((r) => r.json()),
    placeholderData: (previousData) => previousData,
  })
  const savedReports = savedData?.data ?? []

  const currentSource = source ? sources[source] : null
  const availableCols = currentSource?.columns ?? []

  const handleSourceChange = (val: string) => {
    setSource(val)
    setSelectedCols([])
    setFilters([])
    setRows(null)
    setSortBy('')
  }

  const toggleCol = (key: string) => {
    setSelectedCols((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    )
  }

  const addFilter = () => setFilters((prev) => [...prev, { field: availableCols[0]?.key ?? '', op: 'eq', value: '' }])
  const removeFilter = (i: number) => setFilters((prev) => prev.filter((_, idx) => idx !== i))
  const updateFilter = (i: number, patch: Partial<Filter>) =>
    setFilters((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))

  const runMutation = useMutation({
    mutationFn: async (saveIt?: boolean) => {
      const res = await fetch('/api/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: saveIt ? 'save' : 'run',
          source,
          columns: selectedCols,
          filters,
          sortBy: sortBy || undefined,
          sortDir,
          name: saveIt ? reportName : undefined,
          description: saveIt ? reportDesc : undefined,
        }),
      })
      return res.json()
    },
    onSuccess: (data, saveIt) => {
      setRows(data.data?.rows ?? [])
      if (saveIt) {
        setSaveOpen(false)
        refetchSaved()
      }
    },
  })

  const loadSaved = useCallback(async (report: SavedReport) => {
    const src = report.module
    if (!sources[src]) return
    setSource(src)
    setSelectedCols(report.columns ?? [])
    setFilters((report.filters as Filter[]) ?? [])
    setSavedView(false)
    const res = await fetch('/api/reports/builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: src, columns: report.columns, filters: report.filters }),
    })
    const data = await res.json()
    setRows(data.data?.rows ?? [])
  }, [sources])

  const displayCols = selectedCols.length ? selectedCols : availableCols.map((c) => c.key)
  const colDefs = availableCols.filter((c) => displayCols.includes(c.key))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Builder"
        description="Build custom reports from any data source"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSavedView(true)}>
              <BookOpen className="h-4 w-4 mr-1" /> Saved Reports
            </Button>
            {rows && rows.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => csvExport(rows, displayCols)}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left panel — config */}
        <div className="lg:col-span-1 space-y-4">
          {/* Data Source */}
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Data Source</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <Select value={source} onValueChange={handleSourceChange}>
                <SelectTrigger><SelectValue placeholder="Choose source..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(sources).map(([key, ds]) => (
                    <SelectItem key={key} value={key}>{ds.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Columns */}
          {currentSource && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Columns</CardTitle></CardHeader>
              <CardContent className="pt-0 space-y-2">
                {availableCols.map((col) => (
                  <div key={col.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`col-${col.key}`}
                      checked={selectedCols.includes(col.key)}
                      onCheckedChange={() => toggleCol(col.key)}
                    />
                    <label htmlFor={`col-${col.key}`} className="text-sm cursor-pointer">{col.label}</label>
                  </div>
                ))}
                {selectedCols.length > 0 && (
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => setSelectedCols([])}>
                    Clear selection
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          {currentSource && (
            <Card>
              <CardHeader className="py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Filters</CardTitle>
                <Button size="sm" variant="ghost" onClick={addFilter}><Plus className="h-3 w-3" /></Button>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {filters.length === 0 && (
                  <p className="text-xs text-gray-400">No filters — showing all rows</p>
                )}
                {filters.map((f, i) => (
                  <div key={i} className="space-y-1 border rounded p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Filter {i + 1}</span>
                      <button onClick={() => removeFilter(i)}><Trash2 className="h-3 w-3 text-red-400" /></button>
                    </div>
                    <Select value={f.field} onValueChange={(v) => updateFilter(i, { field: v })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {availableCols.map((c) => (
                          <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={f.op} onValueChange={(v) => updateFilter(i, { op: v })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FILTER_OPS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-7 text-xs"
                      placeholder="value..."
                      value={f.value}
                      onChange={(e) => updateFilter(i, { value: e.target.value })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Sort */}
          {currentSource && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Sort</CardTitle></CardHeader>
              <CardContent className="pt-0 space-y-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sort by..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {availableCols.map((c) => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sortBy && (
                  <Select value={sortDir} onValueChange={(v) => setSortDir(v as 'asc' | 'desc')}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {source && (
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={() => runMutation.mutate(false)}
                disabled={runMutation.isPending}
              >
                <Play className="h-4 w-4 mr-1" />
                {runMutation.isPending ? 'Running...' : 'Run Report'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSaveOpen(true)}
                disabled={!rows}
              >
                <Save className="h-4 w-4 mr-1" /> Save Report
              </Button>
            </div>
          )}
        </div>

        {/* Right panel — results */}
        <div className="lg:col-span-3">
          {!source && (
            <Card className="h-64 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a data source to begin</p>
              </div>
            </Card>
          )}

          {rows !== null && (
            <Card>
              <CardHeader className="py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">
                  Results <Badge variant="secondary" className="ml-2">{rows.length} rows</Badge>
                </CardTitle>
                {rows.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => csvExport(rows, displayCols)}>
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {rows.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">No rows match your filters</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {colDefs.map((c) => (
                          <th key={c.key} className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 200).map((row, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          {colDefs.map((c) => {
                            const val = c.key.split('.').reduce(
                              (a: unknown, k) => (a && typeof a === 'object' ? (a as Record<string, unknown>)[k] : undefined),
                              row as unknown
                            )
                            return (
                              <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                                {formatCell(val, c.type)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {rows.length > 200 && (
                  <p className="text-center text-xs text-gray-400 py-2">Showing first 200 of {rows.length} rows. Export CSV for full data.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save Report</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Report Name</Label>
              <Input value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="e.g. Monthly Sales Summary" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={reportDesc} onChange={(e) => setReportDesc(e.target.value)} placeholder="What this report shows..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={() => runMutation.mutate(true)} disabled={!reportName || runMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved Reports Dialog */}
      <Dialog open={savedView} onOpenChange={setSavedView}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Saved Reports</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {savedReports.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No saved reports yet</p>
            )}
            {savedReports.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 cursor-pointer"
                onClick={() => loadSaved(r)}
              >
                <div>
                  <div className="font-medium text-sm">{r.name}</div>
                  <div className="text-xs text-gray-400">{sources[r.module]?.label ?? r.module} · {formatDate(r.createdAt)}</div>
                  {r.description && <div className="text-xs text-gray-500 mt-0.5">{r.description}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {r.isShared && <Badge variant="outline" className="text-xs">Shared</Badge>}
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
