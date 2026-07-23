'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/lib/api-client'
import { accountSchema, type AccountInput } from '@/lib/validations/finance'
import { CrudListPage } from '@/components/shared/CrudListPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

type Account = {
  id: string
  code: string
  name: string
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  parent: { id: string; name: string } | null
  isSystem: boolean
  isActive: boolean
  children: Account[]
  description?: string
}

const typeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'> = {
  ASSET: 'info', LIABILITY: 'warning', EQUITY: 'secondary', REVENUE: 'success', EXPENSE: 'destructive',
}

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const

function AccountForm({ editing, onSave, onCancel, isPending }: {
  editing: Account | null
  onSave: (data: any) => void
  onCancel: () => void
  isPending: boolean
}) {
  const qc = useQueryClient()
  const accounts = qc.getQueryData<Account[]>(['accounts']) ?? []

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<AccountInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: editing ? {
      code: editing.code,
      name: editing.name,
      type: editing.type,
      parentId: editing.parent?.id ?? '',
      description: (editing as any).description ?? '',
    } : {
      code: '',
      name: '',
      type: 'ASSET',
      parentId: '',
      description: '',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="space-y-1">
        <Label>Account Code</Label>
        <Input {...register('code')} placeholder="e.g., 1110" />
        {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
      </div>
      <div className="space-y-1">
        <Label>Account Name</Label>
        <Input {...register('name')} />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>
      <div className="space-y-1">
        <Label>Account Type</Label>
        <Select
          defaultValue={editing?.type ?? 'ASSET'}
          onValueChange={(v) => setValue('type', v as AccountInput['type'])}
        >
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
      </div>
      <div className="space-y-1">
        <Label>Parent Account</Label>
        <Select
          defaultValue={editing?.parent?.id ?? ''}
          onValueChange={(v) => setValue('parentId', v || undefined)}
        >
          <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {accounts
              .filter((a) => editing ? a.id !== editing.id : true)
              .map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Description</Label>
        <Input {...register('description')} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  )
}

export function PageClient({ initialData }: { initialData: Account[] }) {
  const columns = [
    { key: 'code', header: 'Code', sortable: true },
    { key: 'name', header: 'Account Name', sortable: true },
    {
      key: 'type',
      header: 'Type',
      render: (r: Account) => <Badge variant={typeVariant[r.type] ?? 'secondary'}>{r.type}</Badge>,
    },
    { key: 'parent', header: 'Parent', render: (r: Account) => r.parent?.name ?? '-' },
    { key: 'isSystem', header: 'System', render: (r: Account) => r.isSystem ? 'Yes' : 'No' },
    { key: 'isActive', header: 'Active', render: (r: Account) => r.isActive ? 'Yes' : 'No' },
  ]

  return (
    <CrudListPage<Account>
      title="Chart of Accounts"
      description="Manage the hierarchical chart of accounts"
      queryKey={['accounts']}
      apiEndpoint="/api/finance/accounts"
      initialData={initialData}
      searchPlaceholder="Search code or name..."
      searchFields={['name', 'code']}
      columns={columns}
      addButtonLabel="Add Account"
      onSave={async (data, id) => {
        if (id) return api.patch(`/api/finance/accounts/${id}`, data)
        return api.post('/api/finance/accounts', data)
      }}
      onDelete={async (id) => api.delete(`/api/finance/accounts/${id}`)}
      FormComponent={AccountForm}
      formTitle={(editing) => editing ? 'Edit Account' : 'Add Account'}
    />
  )
}
