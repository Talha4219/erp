'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

type Instance = { id: string; entityType: string; entityId: string; status: string; requestedAt: string; rejectionReason: string | null; definition: { name: string; module: string }; requester: { name: string | null; email: string }; actions: { action: string; actedAt: string }[] }

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', IN_PROGRESS: 'bg-blue-100 text-blue-800', APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-700', CANCELLED: 'bg-gray-100 text-gray-600', ESCALATED: 'bg-orange-100 text-orange-800',
}

export function PageClient({ initialPending, initialHistory }: { initialPending: Instance[]; initialHistory: Instance[] }) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Instance | null>(null)
  const [comments, setComments] = useState('')

  const { data: pending = [], isLoading: loadingPending, error: pendingError } = useQuery({
    queryKey: ['workflow', 'PENDING'],
    queryFn: () => api.get<Instance[]>('/api/workflow/instances?status=PENDING').then((r) => r.data ?? []),
    initialData: initialPending,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
  const { data: history = [], isLoading: loadingHistory, error: historyError } = useQuery({
    queryKey: ['workflow', 'history'],
    queryFn: () => api.get<Instance[]>('/api/workflow/instances?status=APPROVED').then((r) => r.data ?? []),
    initialData: initialHistory,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post(`/api/workflow/instances/${id}`, { action, comments }),
    onSuccess: (_, vars) => { toast.success(`Request ${vars.action.toLowerCase()}`); qc.invalidateQueries({ queryKey: ['workflow'] }); setSelected(null); setComments('') },
    onError: () => toast.error('Action failed'),
  })

  const columns = [
    { key: 'definition', header: 'Workflow', render: (r: Instance) => r.definition.name },
    { key: 'entityType', header: 'Type', render: (r: Instance) => r.entityType.replace(/_/g, ' ') },
    { key: 'requester', header: 'Requested By', render: (r: Instance) => r.requester.name ?? r.requester.email },
    { key: 'requestedAt', header: 'Requested', render: (r: Instance) => formatDate(r.requestedAt) },
    { key: 'status', header: 'Status', render: (r: Instance) => <Badge className={STATUS_BADGE[r.status] ?? ''}>{r.status}</Badge> },
    { key: 'actions_col', header: '', render: (r: Instance) => r.status === 'PENDING' || r.status === 'IN_PROGRESS' ? <Button size="sm" variant="outline" onClick={() => setSelected(r)}>Review</Button> : null },
  ]

  return (
    <>
      <PageHeader title="Approval Workflows" description="Review and action pending approval requests" />
      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending"><Clock className="h-4 w-4 mr-1" />Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          {pending.length === 0 && !loadingPending ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              <CheckCircle className="mx-auto h-10 w-10 mb-3 text-green-400 opacity-60" />
              <p>No pending approvals. All caught up!</p>
            </div>
          ) : (
            <DataTable columns={columns} data={pending} isLoading={loadingPending} error={pendingError} />
          )}
        </TabsContent>
        <TabsContent value="history">
          <DataTable columns={columns} data={history} isLoading={loadingHistory} error={historyError} />
        </TabsContent>
      </Tabs>
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setComments('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Review: {selected?.definition.name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-muted p-3 space-y-1">
                <p><span className="font-medium">Type:</span> {selected.entityType}</p>
                <p><span className="font-medium">Requested by:</span> {selected.requester.name ?? selected.requester.email}</p>
                <p><span className="font-medium">On:</span> {formatDate(selected.requestedAt)}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Comments (optional)</label>
                <textarea rows={3} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Add a note for the requester…" value={comments} onChange={(e) => setComments(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setSelected(null); setComments('') }}>Cancel</Button>
            <Button variant="destructive" disabled={act.isPending} onClick={() => selected && act.mutate({ id: selected.id, action: 'REJECTED' })}><XCircle className="h-4 w-4 mr-1" />Reject</Button>
            <Button disabled={act.isPending} onClick={() => selected && act.mutate({ id: selected.id, action: 'APPROVED' })}><CheckCircle className="h-4 w-4 mr-1" />Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
