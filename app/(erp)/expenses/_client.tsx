'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { expenseSchema, type ExpenseInput } from '@/lib/validations/retail'
import { formatGBP, formatUKDate } from '@/lib/uk-locale'
import { CrudListPage } from '@/components/shared/CrudListPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DialogFooter } from '@/components/ui/dialog'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

type ExpenseCategory = { id: number; categoryName: string }
type Supplier = { id: number; companyName: string }
type Expense = {
  id: number
  expenseDate: string
  description: string
  amountGbp: string
  vatClaimedGbp: string
  status: string
  paymentDueDate: string | null
  category: ExpenseCategory
  supplier: Supplier | null
}
type ExpenseRow = Omit<Expense, 'id'> & { id: string }

function ExpenseForm({ editing, onSave, onCancel, isPending }: {
  editing: ExpenseRow | null
  onSave: (data: any) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [selectedCatId, setSelectedCatId] = useState('')
  const [selectedSuppId, setSelectedSuppId] = useState('')

  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api.get<ExpenseCategory[]>('/api/retail/expenses?categories=true').then((r) => r.data ?? []),
    placeholderData: (prev) => prev,
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => api.get<Supplier[]>('/api/retail/suppliers').then((r) => r.data ?? []),
    placeholderData: (prev) => prev,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema) as unknown as Resolver<ExpenseInput>,
    defaultValues: { amountGbp: 0, vatClaimedGbp: 0, status: 'Unpaid' },
  })

  useEffect(() => {
    if (editing) {
      reset({
        expenseDate: editing.expenseDate.split('T')[0],
        description: editing.description,
        amountGbp: Number(editing.amountGbp),
        vatClaimedGbp: Number(editing.vatClaimedGbp),
        paymentDueDate: editing.paymentDueDate ? editing.paymentDueDate.split('T')[0] : undefined,
        status: editing.status as ExpenseInput['status'],
      })
      setSelectedCatId(String(editing.category.id))
      setSelectedSuppId(editing.supplier ? String(editing.supplier.id) : '')
    } else {
      reset({ amountGbp: 0, vatClaimedGbp: 0, status: 'Unpaid' })
      setSelectedCatId('')
      setSelectedSuppId('')
    }
  }, [editing, reset])

  return (
    <form onSubmit={handleSubmit((formData) => {
      onSave({
        ...formData,
        categoryId: parseInt(selectedCatId),
        supplierId: selectedSuppId ? parseInt(selectedSuppId) : undefined,
      })
    })} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Date *</Label>
          <Input {...register('expenseDate')} type="date" />
          {errors.expenseDate && <p className="text-xs text-red-500">{errors.expenseDate.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Category *</Label>
          <Select value={selectedCatId} onValueChange={setSelectedCatId}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.categoryName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Supplier (optional)</Label>
        <Select value={selectedSuppId} onValueChange={setSelectedSuppId}>
          <SelectTrigger><SelectValue placeholder="No supplier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {suppliers.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.companyName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Description *</Label>
        <Input {...register('description')} />
        {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Amount (£) *</Label>
          <Input {...register('amountGbp', { valueAsNumber: true })} type="number" step="0.01" min={0} />
        </div>
        <div className="space-y-1">
          <Label>VAT Reclaimable (£)</Label>
          <Input {...register('vatClaimedGbp', { valueAsNumber: true })} type="number" step="0.01" min={0} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Payment Due Date</Label>
        <Input {...register('paymentDueDate')} type="date" />
      </div>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button type="submit" disabled={isPending || !selectedCatId}>{isPending ? 'Saving…' : editing ? 'Update' : 'Create'}</Button>
      </DialogFooter>
    </form>
  )
}

export function PageClient({ initialData }: { initialData: ExpenseRow[] }) {
  const qc = useQueryClient()

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses-summary'],
    queryFn: () => api.get<Expense[]>('/api/retail/expenses').then((r) => r.data ?? []),
    placeholderData: (prev) => prev,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories-list'],
    queryFn: () => api.get<ExpenseCategory[]>('/api/retail/expenses?categories=true').then((r) => r.data ?? []),
    placeholderData: (prev) => prev,
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/retail/expenses/${id}`, { togglePaid: true }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['expenses'] })
      const previous = qc.getQueryData(['expenses'])
      qc.setQueryData(['expenses'], (old: any[]) => old?.map((item: any) => item.id === id ? { ...item, status: item.status === 'Paid' ? 'Unpaid' : 'Paid' } : item) ?? [])
      return { previous }
    },
    onSuccess: () => { toast.success('Status toggled') },
    onError: (_err, _id, context) => { if (context?.previous) qc.setQueryData(['expenses'], context.previous); toast.error('Failed to toggle') },
    onSettled: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })

  const totalUnpaid = expenses.filter((e) => e.status === 'Unpaid').reduce((s, e) => s + Number(e.amountGbp), 0)
  const totalVat = expenses.filter((e) => e.status === 'Unpaid').reduce((s, e) => s + Number(e.vatClaimedGbp), 0)

  const columns = [
    { key: 'expenseDate', header: 'Date', render: (row: ExpenseRow) => formatUKDate(row.expenseDate) },
    { key: 'category', header: 'Category', render: (row: ExpenseRow) => row.category.categoryName },
    { key: 'supplier', header: 'Supplier', render: (row: ExpenseRow) => row.supplier?.companyName ?? '—' },
    { key: 'description', header: 'Description', render: (row: ExpenseRow) => row.description },
    { key: 'amountGbp', header: 'Amount', render: (row: ExpenseRow) => formatGBP(row.amountGbp) },
    { key: 'vatClaimedGbp', header: 'VAT Reclaimable', render: (row: ExpenseRow) => formatGBP(row.vatClaimedGbp) },
    { key: 'paymentDueDate', header: 'Due Date', render: (row: ExpenseRow) => row.paymentDueDate ? formatUKDate(row.paymentDueDate) : '—' },
    {
      key: 'status', header: 'Status',
      render: (row: ExpenseRow) => (
        <button onClick={() => toggleMutation.mutate(row.id)}>
          <Badge className={row.status === 'Paid' ? 'bg-green-100 text-green-800 cursor-pointer' : 'bg-red-100 text-red-800 cursor-pointer'}>
            {row.status === 'Paid' && <CheckCircle2 className="h-3 w-3 inline mr-1" />}{row.status}
          </Badge>
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-lg p-4">
          <p className="text-sm text-red-600">Total Unpaid</p>
          <p className="text-2xl font-bold text-red-700">{formatGBP(totalUnpaid)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <p className="text-sm text-blue-600">VAT Reclaimable (Unpaid)</p>
          <p className="text-2xl font-bold text-blue-700">{formatGBP(totalVat)}</p>
        </div>
      </div>

      <CrudListPage<ExpenseRow>
        title="Expenses"
        description="Track store expenses, VAT reclaims, and payment status"
        queryKey={['expenses']}
        apiEndpoint="/api/retail/expenses"
        initialData={initialData}
        responseMapper={(r) => (r.data ?? []).map((e: any) => ({ ...e, id: String(e.id) }))}
        columns={columns}
        searchFields={['description', 'category.categoryName', 'supplier.companyName']}
        searchPlaceholder="Search description, category or supplier…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'Paid', label: 'Paid' },
              { value: 'Unpaid', label: 'Unpaid' },
            ],
          },
          {
            key: 'category.id',
            label: 'Category',
            options: categories.map((c) => ({ value: String(c.id), label: c.categoryName })),
          },
          { key: 'from', label: 'From Date', type: 'date' },
          { key: 'to', label: 'To Date', type: 'date' },
        ]}
        filterFn={(item, search, filterValues) => {
          if (filterValues['from'] && item.expenseDate < filterValues['from']) return false
          if (filterValues['to'] && item.expenseDate > filterValues['to']) return false
          return null
        }}
        onSave={async (data, id) => {
          if (id) return api.put(`/api/retail/expenses/${id}`, data)
          return api.post('/api/retail/expenses', data)
        }}
        onDelete={async (id) => api.delete(`/api/retail/expenses/${id}`)}
        FormComponent={ExpenseForm}
        formTitle={(editing) => editing ? 'Edit Expense' : 'New Expense'}
        formSize="lg"
      />
    </div>
  )
}
