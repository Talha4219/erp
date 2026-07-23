'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Plus, Trash2, Download, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

type Doc = { id: string; title: string; category: string; entityType: string | null; entityId: string | null; fileUrl: string; fileName: string; fileSize: number | null; mimeType: string | null; tags: string[]; expiryDate: string | null; notes: string | null; createdAt: string; uploadedById: string }

const CATEGORIES = ['CONTRACT','INVOICE','RECEIPT','REPORT','MANUAL','LICENSE','OTHER']
const CATEGORY_VARIANT: Record<string, 'info'|'warning'|'success'|'secondary'|'destructive'|'default'> = { CONTRACT: 'info', INVOICE: 'warning', RECEIPT: 'success', REPORT: 'secondary', MANUAL: 'default', LICENSE: 'destructive', OTHER: 'secondary' }

export function PageClient({ initialData }: { initialData: Doc[] }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', category: 'OTHER', description: '', tags: '' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['documents'],
    queryFn: () => api.get<Doc[]>('/api/documents').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((d) => {
    if (filterCat && d.category !== filterCat) return false
    if (search) { const q = search.toLowerCase(); return d.title.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q) || d.tags.some((t) => t.toLowerCase().includes(q)) }
    return true
  })

  const createMut = useMutation({
    mutationFn: () => api.post('/api/documents', { ...form, tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [] }),
    onMutate: async () => { await qc.cancelQueries({ queryKey: ['documents'] }); const previous = qc.getQueryData(['documents']); qc.setQueryData(['documents'], (old: any[]) => [{ ...form, id: 'temp-' + Date.now(), tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [], entityType: null, entityId: null, fileUrl: '', fileName: '', fileSize: null, mimeType: null, expiryDate: null, notes: null, createdAt: new Date().toISOString(), uploadedById: '' }, ...(old ?? [])]); return { previous } },
    onSuccess: () => { toast.success('Document created') },
    onError: (err, _vars, context) => { if (context?.previous) qc.setQueryData(['documents'], context.previous); toast.error('Failed to create') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['documents'] }); setShowForm(false) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/documents/${id}`),
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: ['documents'] }); const previous = qc.getQueryData(['documents']); qc.setQueryData(['documents'], (old: any[]) => old.filter((d) => d.id !== id)); return { previous } },
    onSuccess: () => { setDeleteId(null); toast.success('Document deleted') },
    onError: (err, _vars, context) => { if (context?.previous) qc.setQueryData(['documents'], context.previous) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description="Central document repository" actions={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Add Document</Button>} />
      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent><SelectItem value="">All</SelectItem>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
        </Select>
        {(search || filterCat) && <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterCat('') }}><X className="h-4 w-4 mr-1" />Clear</Button>}
      </div>
      <DataTable
        columns={[
          { key: 'title', header: 'Title', sortable: true },
          { key: 'category', header: 'Category', render: (r: Doc) => <Badge variant={CATEGORY_VARIANT[r.category] ?? 'secondary'}>{r.category.replace(/_/g, ' ')}</Badge> },
          { key: 'fileName', header: 'File', render: (r: Doc) => r.fileName || '—' },
          { key: 'fileSize', header: 'Size', render: (r: Doc) => r.fileSize ? `${(r.fileSize / 1024).toFixed(1)} KB` : '—' },
          { key: 'tags', header: 'Tags', render: (r: Doc) => r.tags.length > 0 ? <div className="flex gap-1">{r.tags.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div> : '—' },
          { key: 'createdAt', header: 'Uploaded', render: (r: Doc) => formatDate(r.createdAt) },
        ]}
        data={filtered} isLoading={isLoading} error={error}
        actions={(row) => (
          <div className="flex gap-1">
            {row.fileUrl && <Button variant="ghost" size="icon" asChild><a href={row.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a></Button>}
            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="e.g. finance, urgent" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.title}>{createMut.isPending ? 'Saving…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMut.mutate(deleteId)} loading={deleteMut.isPending} title="Delete Document" description="This document will be permanently removed." />
    </div>
  )
}
