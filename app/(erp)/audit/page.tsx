'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Shield, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'

type AuditLog = {
  id: string
  userId: string
  action: string
  entity: string
  entityId: string
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: { name: string | null; email: string }
}

type Meta = { total: number; page: number; limit: number; pages: number }

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  APPROVE: 'bg-purple-100 text-purple-800',
  REJECT: 'bg-orange-100 text-orange-800',
  LOGIN: 'bg-gray-100 text-gray-700',
  VIEW: 'bg-slate-100 text-slate-700',
}

export default function AuditPage() {
  const [filters, setFilters] = useState({ entity: '', action: '', from: '', to: '', userId: '' })
  const [applied, setApplied] = useState({ entity: '', action: '', from: '', to: '', userId: '' })
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<AuditLog | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', applied, page],
    placeholderData: (previousData) => previousData,
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (applied.entity) params.set('entity', applied.entity)
      if (applied.action) params.set('action', applied.action)
      if (applied.from) params.set('from', applied.from)
      if (applied.to) params.set('to', applied.to)
      if (applied.userId) params.set('userId', applied.userId)
      return api.get<AuditLog[]>(`/api/audit?${params}`).then((r) => r as unknown as { data: AuditLog[]; meta: Meta })
    },
  })

  const logs: AuditLog[] = (data as unknown as { data: AuditLog[] } | undefined)?.data ?? []
  const meta: Meta | undefined = (data as unknown as { meta: Meta } | undefined)?.meta

  function apply() { setApplied({ ...filters }); setPage(1) }
  function reset() { setFilters({ entity: '', action: '', from: '', to: '', userId: '' }); setApplied({ entity: '', action: '', from: '', to: '', userId: '' }); setPage(1) }

  return (
    <>
      <PageHeader
        title="Audit Trail"
        description="Immutable record of all user actions across the ERP system"
      />

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {['CREATE', 'UPDATE', 'DELETE', 'APPROVE'].map((act) => (
          <Card key={act}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase text-muted-foreground font-medium">{act}</p>
              <p className="text-2xl font-bold mt-1">
                {isLoading ? '—' : logs.filter((l) => l.action === act).length}
              </p>
              <p className="text-xs text-muted-foreground">this page</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium">Entity</label>
          <Input className="h-8 w-36 text-sm" placeholder="e.g. Invoice" value={filters.entity} onChange={(e) => setFilters(f => ({ ...f, entity: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Action</label>
          <Select value={filters.action || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, action: v === 'all' ? '' : v }))}>
            <SelectTrigger className="h-8 w-32 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'VIEW'].map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">From</label>
          <Input className="h-8 w-36 text-sm" type="date" value={filters.from} onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">To</label>
          <Input className="h-8 w-36 text-sm" type="date" value={filters.to} onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))} />
        </div>
        <Button size="sm" onClick={apply}><Search className="h-3.5 w-3.5 mr-1" />Search</Button>
        <Button size="sm" variant="outline" onClick={reset}>Reset</Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />)}</div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Shield className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p>No audit logs found</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Timestamp</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Entity</th>
                <th className="px-4 py-3 text-left">Entity ID</th>
                <th className="px-4 py-3 text-left">IP</th>
                <th className="px-4 py-3 text-center">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <p className="text-sm font-medium">{log.user.name ?? '—'}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className={`text-xs font-semibold ${ACTION_COLOR[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                      {log.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 font-medium">{log.entity}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{log.entityId.slice(0, 12)}…</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.ipAddress ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    {(!!log.oldValues || !!log.newValues) && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDetail(log)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta.total} total · page {meta.page} of {meta.pages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Detail — {detail?.action} {detail?.entity}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {detail?.oldValues && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Before</p>
                <pre className="text-xs bg-red-50 rounded p-3 overflow-x-auto border border-red-100">
                  {JSON.stringify(detail.oldValues, null, 2)}
                </pre>
              </div>
            )}
            {detail?.newValues && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">After</p>
                <pre className="text-xs bg-green-50 rounded p-3 overflow-x-auto border border-green-100">
                  {JSON.stringify(detail.newValues, null, 2)}
                </pre>
              </div>
            )}
            {detail?.userAgent && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">User Agent</p>
                <p className="text-xs text-muted-foreground break-all">{detail.userAgent}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
