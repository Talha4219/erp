'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, Column } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { X, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export interface CrudFilter<T = any> {
  key: string
  label: string
  type?: 'select' | 'date'
  options?: { value: string; label: string }[]
  getOptions?: (data: T[]) => { value: string; label: string }[]
}

export interface CrudFormField {
  name: string
  label: string
  type?: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'textarea'
  required?: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
}

export interface CrudListPageProps<T extends Record<string, any>> {
  title: string
  description?: string
  queryKey: string[]
  apiEndpoint: string
  initialData?: T[]
  responseMapper?: (response: any) => T[]
  searchPlaceholder?: string
  searchFields?: string[]
  filters?: CrudFilter<T>[]
  columns: Column<T>[]
  actions?: (row: T) => React.ReactNode
  addButtonLabel?: string
  addButtonHref?: string
  addButtonAction?: () => void
  filterFn?: (item: T, search: string, filterValues: Record<string, string>) => boolean | null

  onSave?: (data: Record<string, any>, id?: string) => Promise<any>
  onDelete?: (id: string) => Promise<any>
  formFields?: CrudFormField[]
  FormComponent?: React.ComponentType<{
    editing: T | null
    onSave: (data: any) => void
    onCancel: () => void
    isPending: boolean
  }>
  formTitle?: string | ((editing: T | null) => string)
  formSize?: 'sm' | 'md' | 'lg' | 'xl'
}

function getValue<T>(item: T, path: string): unknown {
  return path.split('.').reduce<unknown>((obj, k) => {
    if (obj == null) return undefined
    return (obj as Record<string, unknown>)?.[k]
  }, item as unknown as Record<string, unknown>)
}

function deriveOptions<T>(data: T[], key: string): { value: string; label: string }[] {
  const values = Array.from(
    new Set(
      data
        .map((r) => String(getValue(r, key) ?? ''))
        .filter(Boolean)
    )
  )
  return values.map((v) => ({ value: v, label: v.replace(/_/g, ' ') }))
}

const formSizeMap: Record<string, string> = {
  sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl',
}

function getFormTitle(title: string, formTitle: string | ((editing: any) => string) | undefined, editing: any): string {
  if (!formTitle) return editing ? `Edit ${title}` : `New ${title}`
  if (typeof formTitle === 'string') return formTitle
  return formTitle(editing)
}

export function CrudListPage<T extends { id: string } & Record<string, any>>({
  title,
  description,
  queryKey,
  apiEndpoint,
  responseMapper,
  searchPlaceholder = 'Search...',
  searchFields,
  filters = [],
  columns,
  actions,
  addButtonLabel,
  addButtonHref,
  addButtonAction,
  filterFn,
  initialData,

  onSave,
  onDelete,
  formFields,
  FormComponent,
  formTitle,
  formSize = 'md',
}: CrudListPageProps<T>) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})

  const hasCRUD = !!onSave

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      api.get<T[]>(apiEndpoint).then((r) => responseMapper ? responseMapper(r) : (r.data ?? []) as T[]),
    initialData: initialData as T[] | undefined,
    staleTime: initialData ? 30_000 : 0,
  })

  const dataList = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    return dataList.filter((item) => {
      if (filterFn) {
        const result = filterFn(item, search, filterValues)
        if (result !== null) return result
      }

      if (search && searchFields?.length) {
        const q = search.toLowerCase()
        const matched = searchFields.some((field) => {
          const val = getValue(item, field)
          return String(val ?? '').toLowerCase().includes(q)
        })
        if (!matched) return false
      }

      for (const f of filters) {
        if (f.type === 'date') continue
        const filterVal = filterValues[f.key]
        if (!filterVal) continue
        const itemVal = String(getValue(item, f.key) ?? '')
        if (itemVal !== filterVal) return false
      }

      return true
    })
  }, [dataList, search, filterValues, filterFn, filters, searchFields])

  const hasFilters = search || Object.values(filterValues).some(Boolean)

  const setFilter = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setSearch('')
    setFilterValues({})
  }

  const openCreate = () => {
    setEditing(null)
    setFormData({})
    setShowForm(true)
  }

  const openEdit = (row: T) => {
    setEditing(row)
    setFormData({ ...(row as any) } as Record<string, any>)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const saveMutation = useMutation({
    mutationFn: (data: any) => onSave!(data, editing?.id),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData(queryKey)
      qc.setQueryData(queryKey, (old: any[]) => {
        if (!old) return [{ ...newData, id: 'temp-' + Date.now() }]
        if (editing) return old.map((item: any) => item.id === editing.id ? { ...item, ...newData } : item)
        return [{ ...newData, id: 'temp-' + Date.now() }, ...old]
      })
      return { previous }
    },
    onSuccess: () => { toast.success(editing ? 'Updated' : 'Created') },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous)
      toast.error('Failed to save')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => onDelete!(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData(queryKey)
      qc.setQueryData(queryKey, (old: any[]) => old?.filter((item: any) => item.id !== id) ?? [])
      return { previous }
    },
    onSuccess: () => { toast.success('Deleted') },
    onError: (_err, _id, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous)
      toast.error('Failed to delete')
    },
    onSettled: () => { qc.invalidateQueries({ queryKey }); setDeleteId(null) },
  })

  const crudActions = hasCRUD
    ? (row: T) => (
        <div className="flex items-center gap-1">
          {actions?.(row)}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(row)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setDeleteId(row.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )
    : actions

  function handleFormSubmit() {
    saveMutation.mutate(formData)
  }

  function updateFormField(name: string, value: any) {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          hasCRUD ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />{addButtonLabel ?? `New ${title}`}
            </Button>
          ) : addButtonAction ? (
            <Button onClick={addButtonAction}>
              <Plus className="mr-2 h-4 w-4" />{addButtonLabel ?? `New ${title}`}
            </Button>
          ) : addButtonHref ? (
            <Button asChild>
              <Link href={addButtonHref}>
                <Plus className="mr-2 h-4 w-4" />{addButtonLabel ?? `New ${title}`}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {(searchFields?.length || filters.length > 0) && (
        <div className="flex gap-3 flex-wrap">
          {searchFields != null && searchFields.length > 0 && (
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
          )}
          {filters.map((f) => {
            if (f.type === 'date') {
              return (
                <Input
                  key={f.key}
                  type="date"
                  value={filterValues[f.key] ?? ''}
                  onChange={(e) => setFilter(f.key, e.target.value)}
                  className="w-40"
                />
              )
            }
            const options = f.options ?? f.getOptions?.(dataList) ?? deriveOptions(dataList, f.key)
            return (
              <Select
                key={f.key}
                value={filterValues[f.key] ?? ''}
                onValueChange={(v) => setFilter(f.key, v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={`All ${f.label}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          })}
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />Clear
            </Button>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        actions={crudActions}
      />

      {hasCRUD && FormComponent && (
        <Dialog open={showForm} onOpenChange={(o) => !o && closeForm()}>
          <DialogContent className={formSizeMap[formSize] ?? 'max-w-md'}>
            <DialogHeader>
              <DialogTitle>{getFormTitle(title, formTitle, editing)}</DialogTitle>
            </DialogHeader>
            <FormComponent
              editing={editing}
              onSave={(data) => saveMutation.mutate(data)}
              onCancel={closeForm}
              isPending={saveMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {hasCRUD && !FormComponent && formFields && (
        <Dialog open={showForm} onOpenChange={(o) => !o && closeForm()}>
          <DialogContent className={formSizeMap[formSize] ?? 'max-w-md'}>
            <DialogHeader>
              <DialogTitle>{getFormTitle(title, formTitle, editing)}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              {formFields.map((field) => (
                <div key={field.name} className="space-y-1">
                  <Label className="text-xs font-medium">
                    {field.label}{field.required ? ' *' : ''}
                  </Label>
                  {field.type === 'select' ? (
                    <Select
                      value={String(formData[field.name] ?? '')}
                      onValueChange={(v) => updateFormField(field.name, v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={field.placeholder ?? `Select ${field.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === 'checkbox' ? (
                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox
                        id={field.name}
                        checked={!!formData[field.name]}
                        onCheckedChange={(v) => updateFormField(field.name, v)}
                      />
                      <Label htmlFor={field.name} className="text-sm font-normal">{field.label}</Label>
                    </div>
                  ) : field.type === 'textarea' ? (
                    <Textarea
                      placeholder={field.placeholder}
                      value={String(formData[field.name] ?? '')}
                      onChange={(e) => updateFormField(field.name, e.target.value)}
                      className="min-h-[80px]"
                    />
                  ) : (
                    <Input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      placeholder={field.placeholder}
                      value={String(formData[field.name] ?? '')}
                      onChange={(e) => updateFormField(field.name, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                      className="h-9"
                    />
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeForm} disabled={saveMutation.isPending}>Cancel</Button>
              <Button onClick={handleFormSubmit} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {onDelete && (
        <ConfirmDialog
          open={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
          loading={deleteMutation.isPending}
          title={`Delete ${title}`}
          description={`This ${title.toLowerCase()} will be removed.`}
        />
      )}
    </div>
  )
}
