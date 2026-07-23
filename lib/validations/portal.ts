import { z } from 'zod'

export const portalLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const createPortalUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  type: z.enum(['CUSTOMER', 'SUPPLIER']),
  entityId: z.string(),
  phone: z.string().optional(),
})

export const updatePortalUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(8).optional(),
  action: z.enum(['suspend', 'reactivate']).optional(),
})

export const delegationSchema = z.object({
  delegateeId: z.string(),
  module: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
})

export const workflowDefinitionSchema = z.object({
  name: z.string().min(1),
  module: z.string().min(1),
  isActive: z.boolean().default(true),
  steps: z.array(z.object({
    stepOrder: z.number().int().min(1),
    name: z.string().min(1),
    approverRole: z.string().optional(),
    escalateAfterHours: z.number().optional(),
  })).min(1),
})

export const workflowActionSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED', 'ESCALATED']),
  comments: z.string().optional(),
})

export const createWorkflowInstanceSchema = z.object({
  definitionId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
})

export const documentSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  fileUrl: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  tags: z.array(z.string()).default([]),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
})
