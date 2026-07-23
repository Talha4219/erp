import { z } from 'zod'

export const leadSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  source: z.string().default('OTHER'),
  status: z.string().default('NEW'),
  rating: z.number().int().min(0).max(5).default(0),
  notes: z.string().optional(),
  campaignId: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
})

export const leadPatchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  rating: z.number().int().min(0).max(5).optional(),
  notes: z.string().optional(),
  campaignId: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
})

export const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  customerId: z.string().nullable().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
})

export const contactPatchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  customerId: z.string().nullable().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const opportunitySchema = z.object({
  title: z.string().min(1),
  leadId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  stage: z.string().default('PROSPECTING'),
  probability: z.number().int().min(0).max(100).default(0),
  value: z.number().nonnegative().default(0),
  expectedClose: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  notes: z.string().optional(),
})

export const opportunityPatchSchema = z.object({
  title: z.string().min(1).optional(),
  leadId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  stage: z.string().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  value: z.number().nonnegative().optional(),
  expectedClose: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  notes: z.string().optional(),
})

export const campaignSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  status: z.string().default('DRAFT'),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  budget: z.number().nonnegative().nullable().optional(),
  description: z.string().optional(),
  targetAudience: z.string().optional(),
})

export const campaignPatchSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  budget: z.number().nonnegative().nullable().optional(),
  description: z.string().optional(),
  targetAudience: z.string().optional(),
})

export const activitySchema = z.object({
  type: z.string().min(1),
  subject: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  completedAt: z.string().optional(),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  opportunityId: z.string().optional(),
})
