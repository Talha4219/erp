'use client'

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { employeeSchema, type EmployeeInput } from '@/lib/validations/hr'
import { api } from '@/lib/api-client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Camera, Loader2, User } from 'lucide-react'
import Image from 'next/image'

type PrismaEmployee = {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  address?: string | null
  departmentId: string
  designationId: string
  contractType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN'
  employeeTypeId?: number | null
  joinDate: string
  basicSalary: number
  bankAccount?: string | null
  bankName?: string | null
  profileImage?: string | null
}

type EmployeeTypeOption = { id: number; typeName: string; isBuiltIn: boolean }

type Props = {
  open: boolean
  onClose: () => void
  employee?: PrismaEmployee | null
}

const BUILT_IN_TYPES = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
] as const
const GENDERS = ['Male', 'Female', 'Other'] as const

export function EmployeeForm({ open, onClose, employee }: Props) {
  const qc = useQueryClient()
  const isEdit = !!employee
  const [selectedTypeMode, setSelectedTypeMode] = useState<'builtin' | 'custom'>(
    employee?.employeeTypeId ? 'custom' : 'builtin'
  )
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(employee?.profileImage ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<Array<{ id: string; name: string }>>('/api/hr/departments').then((r) => r.data ?? []),
  })

  const { data: designations } = useQuery({
    queryKey: ['designations'],
    queryFn: () => api.get<Array<{ id: string; name: string }>>('/api/hr/designations').then((r) => r.data ?? []),
  })

  const { data: employeeTypes = [] } = useQuery({
    queryKey: ['employee-types'],
    queryFn: () => api.get<EmployeeTypeOption[]>('/api/hr/employee-types').then((r) => r.data ?? []),
  })

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<EmployeeInput>({
    resolver: zodResolver(employeeSchema),
    defaultValues: employee ? {
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone ?? '',
      dateOfBirth: employee.dateOfBirth ?? '',
      gender: employee.gender ?? '',
      address: employee.address ?? '',
      departmentId: employee.departmentId,
      designationId: employee.designationId,
      contractType: employee.contractType,
      employeeTypeId: employee.employeeTypeId ?? null,
      joinDate: typeof employee.joinDate === 'string' ? employee.joinDate.split('T')[0] : employee.joinDate,
      basicSalary: Number(employee.basicSalary),
      bankAccount: employee.bankAccount ?? '',
      bankName: employee.bankName ?? '',
      profileImage: employee.profileImage ?? '',
    } : {
      contractType: 'FULL_TIME',
      basicSalary: 0,
      employeeTypeId: null,
      profileImage: '',
    },
  })

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Upload failed')
      setValue('profileImage', json.data.url)
      setPreviewUrl(json.data.url)
      toast.success('Photo uploaded')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const mutation = useMutation({
    mutationFn: async (data: EmployeeInput) => {
      const res = isEdit
        ? await api.put(`/api/hr/employees/${employee.id}`, data)
        : await api.post('/api/hr/employees', data)
      if (!res.success) throw new Error(res.error ?? 'Failed to save employee')
      return res
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Employee updated' : 'Employee created')
      qc.invalidateQueries({ queryKey: ['employees'] })
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {/* Profile photo upload */}
          <div className="flex justify-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="group relative h-24 w-24 rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/30 hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt="Profile photo"
                    fill
                    className="object-cover"
                    sizes="96px"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <User className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  {uploading
                    ? <Loader2 className="h-6 w-6 text-white animate-spin" />
                    : <Camera className="h-6 w-6 text-white" />
                  }
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground -mt-2">Click photo to upload (max 5 MB)</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Employee Code</Label>
              <Input {...register('employeeCode')} />
              {errors.employeeCode && <p className="text-xs text-red-500">{errors.employeeCode.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>First Name</Label>
              <Input {...register('firstName')} />
              {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Last Name</Label>
              <Input {...register('lastName')} />
              {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Email</Label>
              <Input {...register('email')} type="email" />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Phone</Label>
              <Input {...register('phone')} />
            </div>

            <div className="space-y-1">
              <Label>Date of Birth</Label>
              <Input {...register('dateOfBirth')} type="date" />
            </div>

            <div className="space-y-1">
              <Label>Gender</Label>
              <Select defaultValue={watch('gender') ?? ''} onValueChange={(v) => setValue('gender', v)}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Department</Label>
              <Select defaultValue={watch('departmentId')} onValueChange={(v) => setValue('departmentId', v)}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {(departments ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.departmentId && <p className="text-xs text-red-500">{errors.departmentId.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Designation</Label>
              <Select defaultValue={watch('designationId')} onValueChange={(v) => setValue('designationId', v)}>
                <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
                <SelectContent>
                  {(designations ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.designationId && <p className="text-xs text-red-500">{errors.designationId.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Contract / Employee Type</Label>
              <Select
                defaultValue={employee?.employeeTypeId ? `custom:${employee.employeeTypeId}` : (watch('contractType') ?? 'FULL_TIME')}
                onValueChange={(v) => {
                  if (v.startsWith('custom:')) {
                    const id = parseInt(v.replace('custom:', ''))
                    setValue('contractType', 'CONTRACT')
                    setValue('employeeTypeId', id)
                    setSelectedTypeMode('custom')
                  } else {
                    setValue('contractType', v as EmployeeInput['contractType'])
                    setValue('employeeTypeId', null)
                    setSelectedTypeMode('builtin')
                  }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUILT_IN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  {employeeTypes.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground font-medium border-t mt-1 pt-2">Custom Types</div>
                      {employeeTypes.map((et) => (
                        <SelectItem key={`custom:${et.id}`} value={`custom:${et.id}`}>{et.typeName}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {selectedTypeMode === 'custom' && <p className="text-xs text-muted-foreground">Custom type — stored as Contract internally</p>}
            </div>

            <div className="space-y-1">
              <Label>Join Date</Label>
              <Input {...register('joinDate')} type="date" />
              {errors.joinDate && <p className="text-xs text-red-500">{errors.joinDate.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Basic Salary</Label>
              <Input {...register('basicSalary', { valueAsNumber: true })} type="number" min="0" step="0.01" />
            </div>

            <div className="space-y-1">
              <Label>Address</Label>
              <Input {...register('address')} />
            </div>

            <div className="space-y-1">
              <Label>Bank Name</Label>
              <Input {...register('bankName')} />
            </div>

            <div className="space-y-1">
              <Label>Bank Account No.</Label>
              <Input {...register('bankAccount')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {mutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
