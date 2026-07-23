import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Employee = { id: string; employeeCode: string; firstName: string; lastName: string; email: string; phone?: string | null; dateOfBirth?: string | null; gender?: string | null; address?: string | null; departmentId: string; designationId: string; department: { name: string } | null; designation: { name: string } | null; joinDate: string; isActive: boolean; contractType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN'; employeeTypeId?: number | null; employeeType?: { id: number; typeName: string } | null; basicSalary: number; bankAccount?: string | null; bankName?: string | null; profileImage?: string | null }

export default async function EmployeesPage() {
  const res = await apiServer<{ employees: Employee[] }>('/api/hr/employees')
  const initialData = res.employees ?? []
  return <PageClient initialData={initialData} />
}
