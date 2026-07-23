'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/lib/api-client'
import { journalEntrySchema, type JournalEntryInput } from '@/lib/validations/finance'
import type { Resolver } from 'react-hook-form'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatCurrency } from '@/lib/utils'

type JournalEntry = { id: string; entryNumber: string; date: string; description: string; status: 'DRAFT' | 'POSTED' | 'REVERSED'; reference: string | null; createdBy: { name: string | null } | null }
type Account = { id: string; code: string; name: string; type: string }

const statusVariant: Record<string, 'success' | 'secondary' | 'warning'> = { POSTED: 'success', DRAFT: 'secondary', REVERSED: 'warning' }

const emptyLine = (): JournalEntryInput['lines'][number] => ({ debitAccountId: undefined, creditAccountId: undefined, description: undefined, debitAmount: 0, creditAmount: 0 })

export function PageClient({ initialData }: { initialData: JournalEntry[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['journal-entries'],
    queryFn: () => api.get<JournalEntry[]>('/api/finance/journal').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((r) => {
    if (search) {
      const q = search.toLowerCase()
      if (!r.entryNumber.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q) && !(r.reference ?? '').toLowerCase().includes(q)) return false
    }
    if (filterStatus && r.status !== filterStatus) return false
    if (filterFrom && new Date(r.date) < new Date(filterFrom)) return false
    if (filterTo && new Date(r.date) > new Date(filterTo)) return false
    return true
  })

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<Account[]>('/api/finance/accounts').then((r) => r.data ?? []),
    placeholderData: (prev) => prev,
  })

  const { register, handleSubmit, control, watch, setValue, reset } = useForm<JournalEntryInput>({
    resolver: zodResolver(journalEntrySchema) as unknown as Resolver<JournalEntryInput>,
    defaultValues: { date: new Date().toISOString().split('T')[0], description: '', lines: [emptyLine(), emptyLine()] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  const mutation = useMutation({
    mutationFn: (data: JournalEntryInput) => api.post('/api/finance/journal', data),
    onSuccess: () => { toast.success('Journal entry created'); qc.invalidateQueries({ queryKey: ['journal-entries'] }); setShowForm(false); reset({ date: new Date().toISOString().split('T')[0], description: '', lines: [emptyLine(), emptyLine()] } as JournalEntryInput) },
    onError: (e) => toast.error('Failed: ' + String(e)),
  })

  const postMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/finance/journal/${id}`, { action: 'post' }),
    onSuccess: () => { toast.success('Journal entry posted'); qc.invalidateQueries({ queryKey: ['journal-entries'] }) },
  })

  const lines = watch('lines')
  const totalDebit = lines?.reduce((s, l) => s + (Number(l.debitAmount) || 0), 0) ?? 0
  const totalCredit = lines?.reduce((s, l) => s + (Number(l.creditAmount) || 0), 0) ?? 0
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  const columns = [
    { key: 'entryNumber', header: 'Entry #', sortable: true },
    { key: 'date', header: 'Date', render: (r: JournalEntry) => formatDate(r.date) },
    { key: 'description', header: 'Description' },
    { key: 'reference', header: 'Reference', render: (r: JournalEntry) => r.reference ?? '-' },
    { key: 'createdBy', header: 'Created By', render: (r: JournalEntry) => r.createdBy?.name ?? '-' },
    { key: 'status', header: 'Status', render: (r: JournalEntry) => <Badge variant={statusVariant[r.status] ?? 'secondary'}>{r.status}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Journal Entries" description="Manual journal entries and accounting records"
        actions={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />New Entry</Button>}
      />
      <div className="flex gap-3 flex-wrap mb-2">
        <Input placeholder="Search entry # or description…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="POSTED">Posted</SelectItem>
            <SelectItem value="REVERSED">Reversed</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-40" />
        <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-40" />
        {(search || filterStatus || filterFrom || filterTo) && (
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterStatus(''); setFilterFrom(''); setFilterTo('') }}>Clear</Button>
        )}
      </div>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} error={error}
        actions={(row) => row.status === 'DRAFT' ? <Button size="sm" variant="outline" onClick={() => postMutation.mutate(row.id)}>Post</Button> : null}
      />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Date</Label><Input {...register('date')} type="date" /></div>
              <div className="space-y-1"><Label>Reference</Label><Input {...register('reference')} placeholder="Optional reference" /></div>
              <div className="col-span-2 space-y-1"><Label>Description</Label><Input {...register('description')} /></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lines</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append(emptyLine())}><Plus className="mr-1 h-3 w-3" />Add Line</Button>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Debit Account</th>
                      <th className="p-2 text-left">Credit Account</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-right">Debit</th>
                      <th className="p-2 text-right">Credit</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, i) => (
                      <tr key={field.id} className="border-t">
                        <td className="p-2">
                          <Select onValueChange={(v) => setValue(`lines.${i}.debitAccountId`, v)}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{(accounts ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select onValueChange={(v) => setValue(`lines.${i}.creditAccountId`, v)}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{(accounts ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="p-2"><Input {...register(`lines.${i}.description`)} className="h-8" /></td>
                        <td className="p-2"><Input {...register(`lines.${i}.debitAmount`, { valueAsNumber: true })} type="number" step="0.01" min="0" className="h-8 text-right" /></td>
                        <td className="p-2"><Input {...register(`lines.${i}.creditAmount`, { valueAsNumber: true })} type="number" step="0.01" min="0" className="h-8 text-right" /></td>
                        <td className="p-2">
                          <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} disabled={fields.length <= 2}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted">
                    <tr>
                      <td colSpan={3} className="p-2 font-semibold text-right">Totals:</td>
                      <td className="p-2 text-right font-semibold">{formatCurrency(totalDebit)}</td>
                      <td className="p-2 text-right font-semibold">{formatCurrency(totalCredit)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {!isBalanced && totalDebit + totalCredit > 0 && (
                <p className="text-sm text-red-500">Not balanced. Difference: {formatCurrency(Math.abs(totalDebit - totalCredit))}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending || !isBalanced}>{mutation.isPending ? 'Saving...' : 'Create Entry'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
