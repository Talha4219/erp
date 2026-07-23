import { z } from 'zod'

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.string().default('VIEWER'),
  phone: z.string().optional(),
  isActive: z.boolean().default(true),
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  customRoleId: z.string().nullable().optional(),
})

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  status: z.string().optional(),
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  role: z.string().optional(),
  password: z.string().min(6).optional(),
  customRoleId: z.string().nullable().optional(),
})

export const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
  address: z.string().optional(),
  bio: z.string().optional(),
  onboardingDone: z.boolean().optional(),
})

export const suspendActionSchema = z.object({
  action: z.enum(['suspend', 'reactivate', 'unlock']),
})

export const assignRoleSchema = z.object({
  customRoleId: z.string().min(1),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
})

export const removeRoleSchema = z.object({
  userRoleId: z.string().min(1),
})

export const createGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  userIds: z.array(z.string()).optional(),
})

export const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  addUserIds: z.array(z.string()).optional(),
  removeUserIds: z.array(z.string()).optional(),
})

export const updateDashboardSchema = z.object({
  widgets: z.array(z.any()),
})
