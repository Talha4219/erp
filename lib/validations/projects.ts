import { z } from 'zod'

export const projectSchema = z.object({
  code: z.string().min(1, 'Project code is required'),
  name: z.string().min(2, 'Project name is required'),
  description: z.string().optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).default('PLANNING'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  budget: z.number().nonnegative().default(0),
  managerId: z.string().optional(),
})

export const taskSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  milestoneId: z.string().optional(),
  title: z.string().min(2, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
})

export type ProjectInput = z.infer<typeof projectSchema>
export type TaskInput = z.infer<typeof taskSchema>
