import { z } from 'zod'

export const employeeSchema = z.object({
  employeeCode: z.string().min(1, 'Employee code is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email'),
  departmentId: z.string().min(1, 'Department is required'),
  designationId: z.string().min(1, 'Designation is required'),
  contractType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']),
  employeeTypeId: z.number().int().positive().optional().nullable(),
  joinDate: z.string().min(1, 'Join date is required'),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  basicSalary: z.number().nonnegative().optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  profileImage: z.string().optional(),
})

export const attendanceSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE']),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  notes: z.string().optional(),
})

export const leaveSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  leaveType: z.string().min(1, 'Leave type is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().optional(),
})

export const payrollSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  basicSalary: z.number().nonnegative().default(0),
  allowances: z.number().nonnegative().default(0),
  overtime: z.number().nonnegative().default(0),
  taxDeduction: z.number().nonnegative().default(0),
  socialSecurity: z.number().nonnegative().default(0),
  otherDeductions: z.number().nonnegative().default(0),
})

export const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional(),
  managerId: z.string().optional(),
})

export const designationSchema = z.object({
  name: z.string().min(1, 'Designation name is required'),
  code: z.string().min(1, 'Code is required'),
  level: z.number().int().default(1),
})

export const salaryComponentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['EARNING', 'DEDUCTION']),
  calcMethod: z.enum(['FIXED', 'PERCENTAGE_OF_BASIC']).default('FIXED'),
  value: z.number().nonnegative(),
  isTaxable: z.boolean().default(true),
  isStatutory: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export const shiftSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  shiftDate: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
})

export const documentSchema = z.object({
  docType: z.enum(['CONTRACT', 'PASSPORT', 'NI_LETTER', 'RIGHT_TO_WORK', 'CERTIFICATE', 'P45', 'P60', 'OTHER']).default('OTHER'),
  title: z.string().min(1, 'Title is required'),
  fileUrl: z.string().min(1, 'File URL is required'),
  fileSize: z.number().int().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
})

export const onboardingTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['ONBOARDING', 'OFFBOARDING']),
  isActive: z.boolean().default(true),
  tasks: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    dueAfterDays: z.number().int().nonnegative().default(0),
    assignedRole: z.string().optional(),
    sortOrder: z.number().int().default(0),
  })).default([]),
})

export const startOnboardingSchema = z.object({
  templateId: z.string().optional(),
  type: z.enum(['ONBOARDING', 'OFFBOARDING']),
  startDate: z.string().min(1),
  notes: z.string().optional(),
})

export type EmployeeInput = z.infer<typeof employeeSchema>
export type AttendanceInput = z.infer<typeof attendanceSchema>
export type LeaveInput = z.infer<typeof leaveSchema>
export type PayrollInput = z.infer<typeof payrollSchema>
export type SalaryComponentInput = z.infer<typeof salaryComponentSchema>
export type ShiftInput = z.infer<typeof shiftSchema>
export type DocumentInput = z.infer<typeof documentSchema>
export type OnboardingTemplateInput = z.infer<typeof onboardingTemplateSchema>
export type StartOnboardingInput = z.infer<typeof startOnboardingSchema>
