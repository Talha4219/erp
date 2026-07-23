import prisma from '@/lib/prisma'
import { apiCache } from '@/lib/api-cache'

export function getCompanySettings() {
  return prisma.companySettings.findFirst()
}

export async function upsertCompanySettings(body: Record<string, unknown>) {
  const existing = await prisma.companySettings.findFirst()
  const settings = await prisma.companySettings.upsert({
    where: { id: existing?.id ?? '' },
    update: body,
    create: { name: 'Company', ...existing, ...body } as any,
  })
  apiCache.invalidate('settings')
  return settings
}

export function getPublicCompanySettings() {
  return prisma.companySettings.findFirst({ select: { name: true, logo: true } })
}

export function getSecurityPolicy() {
  return prisma.securityPolicy.findFirst()
}

export async function upsertSecurityPolicy(data: Record<string, unknown>) {
  const existing = await prisma.securityPolicy.findFirst()
  return prisma.securityPolicy.upsert({
    where: { id: existing?.id ?? '' },
    update: data,
    create: data as any,
  })
}

export function listRoles() {
  return prisma.customRole.findMany({
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { userRoles: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function createRole(data: { name: string; description?: string; isActive?: boolean; permissionIds?: string[] }) {
  const { permissionIds, ...roleData } = data
  return prisma.customRole.create({
    data: {
      ...roleData,
      permissions: permissionIds?.length
        ? { create: permissionIds.map((permissionId) => ({ permissionId })) }
        : undefined,
    },
    include: { permissions: { include: { permission: true } }, _count: { select: { userRoles: true } } },
  })
}

export async function patchRole(id: string, data: Record<string, unknown>) {
  const { addPermissionIds, removePermissionIds, addPermissions, updatePermissionScope, updateModuleScope, ...roleData } = data as any

  await prisma.$transaction(async (tx) => {
    if (Object.keys(roleData).length) {
      await tx.customRole.update({ where: { id }, data: roleData })
    }
    if (addPermissionIds?.length) {
      await tx.rolePermission.createMany({
        data: addPermissionIds.map((permissionId: string) => ({ customRoleId: id, permissionId })),
        skipDuplicates: true,
      })
    }
    if (addPermissions?.length) {
      await tx.rolePermission.createMany({
        data: addPermissions.map((p: { permissionId: string; scope?: string }) => ({ customRoleId: id, permissionId: p.permissionId, scope: p.scope ?? null })),
        skipDuplicates: true,
      })
    }
    if (removePermissionIds?.length) {
      await tx.rolePermission.deleteMany({
        where: { customRoleId: id, permissionId: { in: removePermissionIds } },
      })
    }
    if (updatePermissionScope) {
      await tx.rolePermission.updateMany({
        where: { customRoleId: id, permissionId: updatePermissionScope.permissionId },
        data: { scope: updatePermissionScope.scope },
      })
    }
    if (updateModuleScope) {
      const modulePerms = await tx.permission.findMany({ where: { module: updateModuleScope.module } })
      await tx.rolePermission.updateMany({
        where: { customRoleId: id, permissionId: { in: modulePerms.map((p) => p.id) } },
        data: { scope: updateModuleScope.scope },
      })
    }
  })

  return prisma.customRole.findUnique({
    where: { id },
    include: { permissions: { include: { permission: true } }, _count: { select: { userRoles: true } } },
  })
}

export function deleteRole(id: string) {
  return prisma.customRole.delete({ where: { id } })
}

const BUILT_IN_PERMISSIONS = [
  { module: 'dashboard', action: 'view', description: 'View dashboard' },
  { module: 'crm', action: 'view', description: 'View CRM records' },
  { module: 'crm', action: 'create', description: 'Create leads and opportunities' },
  { module: 'crm', action: 'update', description: 'Update CRM records' },
  { module: 'crm', action: 'delete', description: 'Delete CRM records' },
  { module: 'crm', action: 'assign', description: 'Assign leads to users' },
  { module: 'crm', action: 'export', description: 'Export CRM data' },
  { module: 'customers', action: 'view', description: 'View customers' },
  { module: 'customers', action: 'create', description: 'Create customers' },
  { module: 'customers', action: 'update', description: 'Update customers' },
  { module: 'customers', action: 'delete', description: 'Delete customers' },
  { module: 'customers', action: 'export', description: 'Export customer data' },
  { module: 'vendors', action: 'view', description: 'View vendors' },
  { module: 'vendors', action: 'create', description: 'Create vendors' },
  { module: 'vendors', action: 'update', description: 'Update vendors' },
  { module: 'vendors', action: 'delete', description: 'Delete vendors' },
  { module: 'vendors', action: 'export', description: 'Export vendor data' },
  { module: 'sales', action: 'view', description: 'View sales orders and quotes' },
  { module: 'sales', action: 'create', description: 'Create sales orders' },
  { module: 'sales', action: 'update', description: 'Update sales orders' },
  { module: 'sales', action: 'delete', description: 'Delete draft sales orders' },
  { module: 'sales', action: 'approve', description: 'Approve sales orders' },
  { module: 'sales', action: 'reject', description: 'Reject sales orders' },
  { module: 'sales', action: 'cancel', description: 'Cancel sales orders' },
  { module: 'sales', action: 'print', description: 'Print sales documents' },
  { module: 'sales', action: 'export', description: 'Export sales data' },
  { module: 'procurement', action: 'view', description: 'View purchase orders and requests' },
  { module: 'procurement', action: 'create', description: 'Create purchase requests and orders' },
  { module: 'procurement', action: 'update', description: 'Update procurement records' },
  { module: 'procurement', action: 'delete', description: 'Delete draft procurement records' },
  { module: 'procurement', action: 'approve', description: 'Approve purchase orders' },
  { module: 'procurement', action: 'reject', description: 'Reject purchase orders' },
  { module: 'procurement', action: 'cancel', description: 'Cancel purchase orders' },
  { module: 'procurement', action: 'print', description: 'Print procurement documents' },
  { module: 'procurement', action: 'export', description: 'Export procurement data' },
  { module: 'inventory', action: 'view', description: 'View inventory and stock levels' },
  { module: 'inventory', action: 'create', description: 'Create inventory records' },
  { module: 'inventory', action: 'update', description: 'Update inventory records' },
  { module: 'inventory', action: 'delete', description: 'Delete inventory records' },
  { module: 'inventory', action: 'transfer', description: 'Transfer stock between warehouses' },
  { module: 'inventory', action: 'adjust', description: 'Make stock adjustments' },
  { module: 'inventory', action: 'export', description: 'Export inventory data' },
  { module: 'finance', action: 'view', description: 'View financial records' },
  { module: 'finance', action: 'create', description: 'Create financial records' },
  { module: 'finance', action: 'update', description: 'Update financial records' },
  { module: 'finance', action: 'delete', description: 'Delete draft financial records' },
  { module: 'finance', action: 'approve', description: 'Approve financial transactions' },
  { module: 'finance', action: 'journal', description: 'Post journal entries' },
  { module: 'finance', action: 'export', description: 'Export financial data' },
  { module: 'hr', action: 'view', description: 'View HR records' },
  { module: 'hr', action: 'create', description: 'Create employees and HR records' },
  { module: 'hr', action: 'update', description: 'Update HR records' },
  { module: 'hr', action: 'delete', description: 'Delete HR records' },
  { module: 'hr', action: 'manage', description: 'Manage all HR operations' },
  { module: 'hr', action: 'export', description: 'Export HR data' },
  { module: 'payroll', action: 'view', description: 'View payroll records' },
  { module: 'payroll', action: 'create', description: 'Create payroll runs' },
  { module: 'payroll', action: 'approve', description: 'Approve payroll' },
  { module: 'payroll', action: 'export', description: 'Export payroll data' },
  { module: 'pos', action: 'view', description: 'View POS records' },
  { module: 'pos', action: 'create', description: 'Create POS transactions' },
  { module: 'documents', action: 'view', description: 'View documents' },
  { module: 'documents', action: 'create', description: 'Upload documents' },
  { module: 'documents', action: 'delete', description: 'Delete documents' },
  { module: 'documents', action: 'archive', description: 'Archive documents' },
  { module: 'tasks', action: 'view', description: 'View tasks and projects' },
  { module: 'tasks', action: 'create', description: 'Create tasks' },
  { module: 'tasks', action: 'update', description: 'Update tasks' },
  { module: 'tasks', action: 'assign', description: 'Assign tasks to users' },
  { module: 'tasks', action: 'close', description: 'Close completed tasks' },
  { module: 'reports', action: 'view', description: 'View reports' },
  { module: 'reports', action: 'export', description: 'Export report data' },
  { module: 'reports', action: 'configure', description: 'Configure report schedules' },
  { module: 'insights', action: 'view', description: 'View analytics and insights' },
  { module: 'insights', action: 'export', description: 'Export analytics data' },
  { module: 'notifications', action: 'view', description: 'View notifications' },
  { module: 'notifications', action: 'configure', description: 'Configure notification settings' },
  { module: 'workflow', action: 'view', description: 'View workflow instances' },
  { module: 'workflow', action: 'approve', description: 'Approve workflow steps' },
  { module: 'workflow', action: 'reject', description: 'Reject workflow steps' },
  { module: 'workflow', action: 'manage', description: 'Manage workflow definitions' },
  { module: 'workflow', action: 'configure', description: 'Configure workflow templates' },
  { module: 'fulfillment', action: 'view', description: 'View fulfillment orders and deliveries' },
  { module: 'fulfillment', action: 'create', description: 'Create fulfillment orders and pick lists' },
  { module: 'fulfillment', action: 'update', description: 'Update fulfillment records' },
  { module: 'fulfillment', action: 'delete', description: 'Delete fulfillment records' },
  { module: 'fulfillment', action: 'approve', description: 'Approve fulfillments and shipments' },
  { module: 'fulfillment', action: 'manage', description: 'Manage vehicles, drivers, and warehouse operations' },
  { module: 'audit', action: 'view', description: 'View audit logs' },
  { module: 'audit', action: 'export', description: 'Export audit logs' },
  { module: 'users', action: 'view', description: 'View user directory' },
  { module: 'users', action: 'create', description: 'Create user accounts' },
  { module: 'users', action: 'update', description: 'Update user profiles' },
  { module: 'users', action: 'delete', description: 'Delete user accounts' },
  { module: 'users', action: 'suspend', description: 'Suspend or reactivate users' },
  { module: 'users', action: 'configure', description: 'Configure user access settings' },
  { module: 'roles', action: 'view', description: 'View roles' },
  { module: 'roles', action: 'create', description: 'Create custom roles' },
  { module: 'roles', action: 'update', description: 'Update roles' },
  { module: 'roles', action: 'delete', description: 'Delete roles' },
  { module: 'roles', action: 'configure', description: 'Configure role permissions' },
  { module: 'permissions', action: 'view', description: 'View permission definitions' },
  { module: 'permissions', action: 'configure', description: 'Configure system permissions' },
  { module: 'settings', action: 'view', description: 'View system settings' },
  { module: 'settings', action: 'manage', description: 'Manage all system settings' },
  { module: 'settings', action: 'configure', description: 'Configure security and policies' },
]

export async function seedBuiltInPermissions() {
  await prisma.permission.createMany({ data: BUILT_IN_PERMISSIONS, skipDuplicates: true })
}

export function listPermissions() {
  return prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] })
}

export function listPaymentTerms() {
  return prisma.paymentTerm.findMany({ orderBy: [{ type: 'asc' }, { netDays: 'asc' }] })
}

export function createPaymentTerm(data: Record<string, unknown>) {
  return prisma.paymentTerm.create({ data: data as any })
}

export function updatePaymentTerm(id: string, data: Record<string, unknown>) {
  return prisma.paymentTerm.update({ where: { id }, data: data as any })
}

export function deletePaymentTerm(id: string) {
  return prisma.paymentTerm.delete({ where: { id } })
}

export function listNumberingSeries(module?: string | null) {
  return prisma.numberingSeries.findMany({
    where: module ? { module } : {},
    orderBy: [{ module: 'asc' }, { isDefault: 'desc' }],
    include: { company: { select: { name: true } } },
  })
}

export function createNumberingSeries(data: Record<string, unknown>) {
  return prisma.numberingSeries.create({ data: data as any })
}

export function updateNumberingSeries(id: string, data: Record<string, unknown>) {
  return prisma.numberingSeries.update({ where: { id }, data: data as any })
}

export function deleteNumberingSeries(id: string) {
  return prisma.numberingSeries.delete({ where: { id } })
}

export function listNotificationTemplates() {
  return prisma.notificationTemplate.findMany({ orderBy: { code: 'asc' } })
}

export function createNotificationTemplate(data: Record<string, unknown>) {
  return prisma.notificationTemplate.create({ data: data as any })
}

export function updateNotificationTemplate(id: string, data: Record<string, unknown>) {
  return prisma.notificationTemplate.update({ where: { id }, data: data as any })
}

export function deleteNotificationTemplate(id: string) {
  return prisma.notificationTemplate.delete({ where: { id } })
}

export function listIntegrations() {
  return prisma.integrationConfig.findMany({ orderBy: { key: 'asc' } })
}

export async function upsertIntegration(body: { key: string; name?: string; isConnected?: boolean; config?: any }) {
  return prisma.integrationConfig.upsert({
    where: { key: body.key },
    update: { name: body.name, isConnected: body.isConnected, config: body.config, lastSyncAt: body.isConnected ? new Date() : undefined },
    create: { key: body.key, name: body.name ?? '', isConnected: !!body.isConnected, config: body.config, lastSyncAt: body.isConnected ? new Date() : undefined },
  })
}

export function getEmailConfig() {
  return prisma.emailConfig.findFirst()
}

export async function upsertEmailConfig(body: Record<string, unknown>) {
  const existing = await prisma.emailConfig.findFirst()
  return prisma.emailConfig.upsert({
    where: { id: existing?.id ?? '' },
    update: body,
    create: body as any,
  })
}

export function listCompanies() {
  return prisma.company.findMany({
    include: { _count: { select: { branches: true } } },
    orderBy: { name: 'asc' },
  })
}

export function createCompany(data: Record<string, unknown>) {
  return prisma.company.create({ data: data as any })
}

export function listBranches(companyId?: string | null) {
  return prisma.branch.findMany({
    where: {
      isActive: true,
      ...(companyId ? { companyId } : {}),
    },
    include: { company: { select: { name: true } } },
    orderBy: [{ company: { name: 'asc' } }, { name: 'asc' }],
  })
}

export function createBranch(data: Record<string, unknown>) {
  return prisma.branch.create({
    data: data as any,
    include: { company: { select: { name: true } } },
  })
}

const DEFAULT_INTEGRATIONS = [
  { key: 'sms', name: 'SMS Gateway' },
  { key: 'whatsapp', name: 'WhatsApp API' },
  { key: 'payment_gateway', name: 'Payment Gateway' },
]

export async function listIntegrationsWithDefaults() {
  const existing = await listIntegrations()
  const existingKeys = new Set(existing.map((i) => i.key))
  const missing = DEFAULT_INTEGRATIONS.filter((d) => !existingKeys.has(d.key))
  return [
    ...existing,
    ...missing.map((d) => ({ id: null as string | null, key: d.key, name: d.name, isConnected: false, config: null, lastSyncAt: null, updatedAt: null })),
  ].sort((a, b) => a.key.localeCompare(b.key))
}

export async function getInitData() {
  await seedBuiltInPermissions()

  const [
    settings, storeSettings, users, companies, branches,
    numberingSeries, permissions, roles, paymentTerms, securityPolicy,
    notificationTemplates, workflowDefinitions, integrations, emailConfig,
    expenseCategories, employeeTypes,
  ] = await Promise.all([
    getCompanySettings(),
    prisma.storeSettings.findFirst(),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true, userRoles: { select: { customRole: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    listCompanies(),
    listBranches(),
    listNumberingSeries(),
    listPermissions(),
    listRoles(),
    listPaymentTerms(),
    getSecurityPolicy(),
    listNotificationTemplates(),
    prisma.workflowDefinition.findMany({ include: { steps: { orderBy: { stepOrder: 'asc' } }, _count: { select: { instances: true } } } }),
    listIntegrationsWithDefaults(),
    getEmailConfig(),
    prisma.expenseCategory.findMany({ select: { id: true, categoryName: true }, orderBy: { categoryName: 'asc' } }),
    prisma.employeeType.findMany({ orderBy: { typeName: 'asc' } }),
  ])

  return {
    settings, storeSettings, users, companies, branches,
    numberingSeries, permissions, roles, paymentTerms, securityPolicy,
    notificationTemplates, workflowDefinitions, integrations, emailConfig,
    expenseCategories, employeeTypes,
  }
}
