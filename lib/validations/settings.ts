import { z } from 'zod'

export const companySchema = z.object({
  name: z.string().min(1),
  legalName: z.string().optional(),
  logo: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  taxId: z.string().optional(),
  currency: z.string().default('USD'),
  currencySymbol: z.string().default('$'),
  fiscalYearStart: z.number().int().min(1).max(12).default(1),
  fiscalYearEnd: z.number().int().min(1).max(12).default(12),
  dateFormat: z.string().default('MM/DD/YYYY'),
  timezone: z.string().default('UTC'),
  language: z.string().default('en'),
  theme: z.string().default('light'),
  compactTables: z.boolean().default(false),
  stickySidebar: z.boolean().default(true),
  animationsEnabled: z.boolean().default(true),
})

export const securityPolicySchema = z.object({
  maxLoginAttempts: z.number().int().min(1).optional(),
  lockoutDurationMins: z.number().int().min(1).optional(),
  sessionTimeoutMins: z.number().int().min(1).optional(),
  passwordMinLength: z.number().int().min(4).max(128).optional(),
  passwordRequireUpper: z.boolean().optional(),
  passwordRequireNumber: z.boolean().optional(),
  passwordRequireSpecial: z.boolean().optional(),
  mfaRequired: z.boolean().optional(),
})

export const roleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  permissionIds: z.array(z.string()).optional(),
})

export const rolePatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  addPermissionIds: z.array(z.string()).optional(),
  removePermissionIds: z.array(z.string()).optional(),
  addPermissions: z.array(z.object({
    permissionId: z.string(),
    scope: z.string().optional(),
  })).optional(),
  updatePermissionScope: z.object({
    permissionId: z.string(),
    scope: z.string().nullable(),
  }).optional(),
  updateModuleScope: z.object({
    module: z.string(),
    scope: z.string(),
  }).optional(),
})

export const paymentTermSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1),
  type: z.enum(['NET_DAYS', 'END_OF_MONTH', 'CASH_ON_DELIVERY', 'PREPAID', 'INSTALLMENT']).default('NET_DAYS'),
  netDays: z.number().int().min(0).default(30),
  discountDays: z.number().int().min(0).nullable().optional(),
  discountPct: z.number().min(0).max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
})

export const paymentTermPatchSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['NET_DAYS', 'END_OF_MONTH', 'CASH_ON_DELIVERY', 'PREPAID', 'INSTALLMENT']).optional(),
  netDays: z.number().int().min(0).optional(),
  discountDays: z.number().int().min(0).nullable().optional(),
  discountPct: z.number().min(0).max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const numberingSeriesSchema = z.object({
  module: z.string().min(1),
  prefix: z.string().min(1),
  suffix: z.string().optional(),
  nextNumber: z.number().int().min(1).optional(),
  padding: z.number().int().min(1).max(10).optional(),
  resetAnnually: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  companyId: z.string().optional(),
})

export const numberingSeriesPatchSchema = z.object({
  prefix: z.string().min(1).optional(),
  suffix: z.string().optional(),
  nextNumber: z.number().int().min(1).optional(),
  padding: z.number().int().min(1).max(10).optional(),
  resetAnnually: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})

export const notificationTemplateSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  bodyTemplate: z.string().min(1),
  channel: z.enum(['IN_APP', 'EMAIL', 'SMS', 'WEBHOOK']).optional(),
  type: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const integrationSchema = z.object({
  key: z.string().min(1),
  name: z.string().optional(),
  isConnected: z.boolean().optional(),
  config: z.any().optional(),
})

export const emailConfigSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.number().int().default(587),
  secure: z.boolean().default(false),
  username: z.string().min(1, 'Username is required'),
  password: z.string().optional(),
  fromEmail: z.string().min(1, 'From email is required'),
  fromName: z.string().optional(),
  isActive: z.boolean().default(false),
})

export const createCompanySchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  currency: z.string().default('GBP'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  isActive: z.boolean().default(true),
})

export const createBranchSchema = z.object({
  companyId: z.string().min(1),
  code: z.string().min(1).max(10),
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  isHead: z.boolean().default(false),
})
