'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import {
  Plus, Trash2, LayoutDashboard, RefreshCw, Eye, EyeOff, ChevronUp, ChevronDown, Pencil, Save,
  Search, Home, Building2, Users, ShieldCheck, Workflow, Store, Percent, AlertTriangle,
  Wallet, Layers, GitBranch, Hash, CreditCard, Bell, Lock, ArrowRight, X, RotateCcw,
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Role } from '@prisma/client'
import Link from 'next/link'
import { CURRENCY_META, SUPPORTED_CURRENCIES } from '@/lib/currency-store'

type StoreSettings = {
  id: string
  storeName: string
  storeAddress: string | null
  vatRegistrationNumber: string | null
  vatQuarterMonth1: number
  vatQuarterMonth2: number
  vatQuarterMonth3: number
  vatQuarterMonth4: number
  defaultVatGroceries: string
  defaultVatToiletries: string
  defaultVatClothing: string
  defaultVatElectronics: string
  loyaltyPointsPerPound: number
  loyaltyRedemptionRate: number
  wageCostTargetPct: string
  alertFefo7Day: boolean
  alertLowStock: boolean
  alertVisaExpiry: boolean
  alertWtdBreach: boolean
}

type User = {
  id: string
  name: string | null
  email: string
  role: Role
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  userRoles: { customRole: { id: string; name: string } }[]
}

type ExpenseCategory = { id: number; categoryName: string }
type EmployeeType = { id: number; typeName: string; isBuiltIn: boolean }

type SecurityPolicy = {
  id: string; maxLoginAttempts: number; lockoutDurationMins: number; sessionTimeoutMins: number
  passwordMinLength: number; passwordRequireUpper: boolean; passwordRequireNumber: boolean
  passwordRequireSpecial: boolean; mfaRequired: boolean
}
type NotificationTemplate = {
  id: string; code: string; title: string; bodyTemplate: string
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WEBHOOK'
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS' | 'ACTION_REQUIRED'
  isActive: boolean
}
type EmailConfig = { id: string; host: string; port: number; secure: boolean; username: string; fromEmail: string; fromName: string | null; isActive: boolean }
type WorkflowStep = { id: string; stepOrder: number; name: string; approverRole: string | null; escalateAfterHours: number | null }
type WorkflowDefinition = { id: string; name: string; module: string; isActive: boolean; steps: WorkflowStep[]; _count: { instances: number } }

type SettingsCategory = {
  value: string
  label: string
  group: 'Core' | 'Operations' | 'System'
  icon: typeof Building2
  keywords: string[]
  description: string
  impact: string
}

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { value: 'general', label: 'General', group: 'Core', icon: Home, keywords: ['theme', 'language', 'timezone', 'date format', 'currency', 'appearance', 'dark mode'], description: 'Appearance, locale, and UI preferences that apply across the whole ERP.', impact: 'Affects every screen and every user.' },
  { value: 'company', label: 'Company Profile', group: 'Core', icon: Building2, keywords: ['company', 'tax', 'registration', 'logo', 'legal name'], description: 'Core company identity used on invoices, documents, and reports.', impact: 'Finance, Sales, Procurement documents.' },
  { value: 'users', label: 'User Management', group: 'Core', icon: Users, keywords: ['user', 'password', 'login', 'account'], description: 'Create, deactivate, and manage user accounts and dashboard access.', impact: 'All modules — controls who can log in.' },
  { value: 'roles', label: 'Roles & Permissions', group: 'Core', icon: ShieldCheck, keywords: ['role', 'permission', 'access', 'matrix'], description: 'Define custom roles and the view/create/edit/delete/approve matrix per module.', impact: 'All modules — controls what users can do.' },
  { value: 'workflow', label: 'Workflow', group: 'Core', icon: Workflow, keywords: ['approval', 'workflow', 'escalation', 'chain'], description: 'Approval chains for purchase requests, orders, and other guarded actions.', impact: 'Procurement, Finance, HR approvals.' },
  { value: 'store', label: 'Store Profile', group: 'Operations', icon: Store, keywords: ['store', 'retail'], description: 'Retail store identity and VAT quarter configuration.', impact: 'Retail / POS module.' },
  { value: 'vat', label: 'VAT & Loyalty', group: 'Operations', icon: Percent, keywords: ['vat', 'tax', 'loyalty', 'points'], description: 'Default VAT rates by category and loyalty points configuration.', impact: 'Retail POS pricing and receipts.' },
  { value: 'alerts', label: 'Compliance Alerts', group: 'Operations', icon: AlertTriangle, keywords: ['compliance', 'alert', 'expiry', 'wtd'], description: 'Toggle which compliance alerts are surfaced to staff.', impact: 'Retail dashboard alerts.' },
  { value: 'expense-categories', label: 'Expense Categories', group: 'Operations', icon: Wallet, keywords: ['expense', 'category'], description: 'Categories used to classify business expenses.', impact: 'Finance expense tracking.' },
  { value: 'employee-types', label: 'Employee Types', group: 'Operations', icon: Layers, keywords: ['employee', 'hr', 'contract type'], description: 'Employment classifications used across HR records.', impact: 'HR module.' },
  { value: 'companies', label: 'Companies', group: 'Operations', icon: Building2, keywords: ['company', 'multi-company', 'subsidiary'], description: 'Legal entities for multi-company setups.', impact: 'Finance consolidation, documents.' },
  { value: 'branches', label: 'Branches', group: 'Operations', icon: GitBranch, keywords: ['branch', 'location', 'site'], description: 'Physical branches/locations under each company.', impact: 'Inventory, POS, HR assignment.' },
  { value: 'numbering', label: 'Numbering', group: 'Operations', icon: Hash, keywords: ['numbering', 'sequence', 'invoice number', 'prefix'], description: 'Document numbering series (prefixes, padding, reset rules).', impact: 'All transactional documents.' },
  { value: 'payment-terms', label: 'Payment Terms', group: 'Operations', icon: CreditCard, keywords: ['payment', 'terms', 'net 30', 'discount'], description: 'Standard payment terms offered on sales and purchase documents.', impact: 'Sales and Procurement documents.' },
  { value: 'notifications', label: 'Notifications', group: 'System', icon: Bell, keywords: ['notification', 'email', 'sms', 'template', 'alert'], description: 'Message templates and channels used for system notifications.', impact: 'All modules that send alerts.' },
  { value: 'security', label: 'Security', group: 'System', icon: Lock, keywords: ['security', 'password policy', '2fa', 'session', 'lockout'], description: 'Password policy, session timeout, and login protection for all users.', impact: 'All users — login and session behaviour.' },
]

export default function SettingsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('home')
  const [settingsSearch, setSettingsSearch] = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null)
  const [newTypeName, setNewTypeName] = useState('')
  const [deleteTypeId, setDeleteTypeId] = useState<number | null>(null)
  const [companyForm, setCompanyForm] = useState({ code: '', name: '', legalName: '', taxId: '', currency: 'GBP', address: '', phone: '', email: '' })
  const [branchForm, setBranchForm] = useState({ companyId: '', code: '', name: '', address: '', city: '', phone: '', email: '', isHead: false })
  const [numForm, setNumForm] = useState({ module: '', prefix: '', suffix: '', nextNumber: 1, padding: 5, resetAnnually: false, isDefault: false })
  const [editNumId, setEditNumId] = useState<string | null>(null)
  const [editNumForm, setEditNumForm] = useState({ prefix: '', suffix: '', nextNumber: 1, padding: 5, resetAnnually: false })
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', customRoleId: '' })
  const [dashboardUserId, setDashboardUserId] = useState<string | null>(null)
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [editUserForm, setEditUserForm] = useState({ name: '', email: '', password: '', customRoleId: '' })
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissionIds: [] as string[], submodules: {} as Record<string, string[]> })
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [editRoleId, setEditRoleId] = useState<string | null>(null)
  const [editRoleName, setEditRoleName] = useState('')
  const [editRoleDesc, setEditRoleDesc] = useState('')
  const [ptForm, setPtForm] = useState({ code: '', name: '', type: 'NET_DAYS', netDays: 30, discountDays: '', discountPct: '', description: '', isActive: true })
  const [securityForm, setSecurityForm] = useState({
    maxLoginAttempts: 5, lockoutDurationMins: 15, sessionTimeoutMins: 480,
    passwordMinLength: 8, passwordRequireUpper: true, passwordRequireNumber: true,
    passwordRequireSpecial: false, mfaRequired: false,
  })
  const [templateForm, setTemplateForm] = useState({ code: '', title: '', bodyTemplate: '', channel: 'IN_APP', type: 'INFO' })
  const [workflowForm, setWorkflowForm] = useState({ name: '', module: '', approverRole: '', escalateAfterHours: '' })

  const { data: batchData, isLoading: batchLoading } = useQuery({
    queryKey: ['settings-init'],
    queryFn: () => api.get<{
      settings: Record<string, unknown> | null
      storeSettings: StoreSettings | null
      users: User[]
      companies: Array<{ id: string; code: string; name: string; currency: string; isActive: boolean; _count: { branches: number } }>
      branches: Array<{ id: string; companyId: string; code: string; name: string; city: string | null; isHead: boolean; company: { name: string } }>
      numberingSeries: NumberingSeries[]
      permissions: Permission[]
      roles: CustomRole[]
      paymentTerms: PaymentTerm[]
      securityPolicy: SecurityPolicy | null
      notificationTemplates: NotificationTemplate[]
      workflowDefinitions: WorkflowDefinition[]
      emailConfig: EmailConfig | null
      expenseCategories: ExpenseCategory[]
      employeeTypes: EmployeeType[]
    }>('/api/settings/init').then((r) => r.data),
    staleTime: 30_000,
  })

  const settings = batchData?.settings
  const storeSettings = batchData?.storeSettings
  const users = batchData?.users
  const usersLoading = batchLoading

  const { register, handleSubmit, watch, setValue } = useForm({
    values: settings as Record<string, string> | undefined,
  })
  const selectedCurrency = watch('currency')

  const { register: regStore, handleSubmit: hsStore } = useForm<StoreSettings>({
    values: storeSettings ?? undefined,
  })

  const settingsMutation = useMutation({
    mutationFn: (data: unknown) => api.put('/api/settings', data),
    onSuccess: () => {
      toast.success('Settings saved')
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['company-settings-branding'] })
    },
    onError: () => toast.error('Failed to save settings'),
  })

  const storeMutation = useMutation({
    mutationFn: (data: Partial<StoreSettings>) => api.put('/api/retail/store-settings', data),
    onSuccess: () => {
      toast.success('Store settings saved')
      qc.invalidateQueries({ queryKey: ['store-settings'] })
    },
    onError: () => toast.error('Failed to save store settings'),
  })

  const toggleUserMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/users/${id}`, { isActive }),
    onSuccess: () => {
      toast.success('User updated')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const createUserMutation = useMutation({
    mutationFn: (d: typeof userForm) => api.post('/api/users', d),
    onSuccess: () => {
      toast.success('User created')
      qc.invalidateQueries({ queryKey: ['users'] })
      setUserForm({ name: '', email: '', password: '', customRoleId: '' })
    },
    onError: (e: unknown) => toast.error(String((e as { message?: string })?.message ?? 'Failed to create user')),
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editUserForm }) => {
      const payload: Record<string, unknown> = { name: data.name, email: data.email }
      if (data.password) payload.password = data.password
      if (data.customRoleId !== undefined) payload.customRoleId = data.customRoleId || null
      return api.patch(`/api/users/${id}`, payload)
    },
    onSuccess: () => {
      toast.success('User updated')
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditUserId(null)
    },
    onError: () => toast.error('Failed to update user'),
  })

  type DashboardWidget = { id: string; title: string; type: string; module: string; requiredPermission: string; visible: boolean; order: number }
  type DashboardConfig = { id: string; userId: string; widgets: DashboardWidget[]; updatedAt: string }

  const { data: dashboardConfig, isLoading: dashboardLoading } = useQuery({
    queryKey: ['user-dashboard', dashboardUserId],
    queryFn: () => api.get<DashboardConfig>(`/api/users/${dashboardUserId}/dashboard`).then((r) => r.data),
    enabled: !!dashboardUserId,
  })

  const [localWidgets, setLocalWidgets] = useState<DashboardWidget[]>([])

  const saveDashboardMutation = useMutation({
    mutationFn: ({ userId, widgets }: { userId: string; widgets: DashboardWidget[] }) =>
      api.put(`/api/users/${userId}/dashboard`, { widgets }),
    onSuccess: () => {
      toast.success('Dashboard saved')
      qc.invalidateQueries({ queryKey: ['user-dashboard', dashboardUserId] })
    },
    onError: () => toast.error('Failed to save dashboard'),
  })

  const regenerateDashboardMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/api/users/${userId}/dashboard`, {}),
    onSuccess: () => {
      toast.success('Dashboard regenerated from role')
      qc.invalidateQueries({ queryKey: ['user-dashboard', dashboardUserId] })
    },
    onError: () => toast.error('Failed to regenerate'),
  })

  useEffect(() => {
    if (dashboardConfig?.widgets) {
      setLocalWidgets([...dashboardConfig.widgets].sort((a, b) => a.order - b.order))
    }
  }, [dashboardConfig])

  const expenseCategories: ExpenseCategory[] = batchData?.expenseCategories ?? []
  const employeeTypes: EmployeeType[] = batchData?.employeeTypes ?? []

  const addCategoryMutation = useMutation({
    mutationFn: (categoryName: string) => api.post('/api/retail/expenses', { categoryName }),
    onSuccess: () => {
      toast.success('Category added')
      qc.invalidateQueries({ queryKey: ['expense-categories-settings'] })
      qc.invalidateQueries({ queryKey: ['expense-categories'] })
      setNewCatName('')
    },
    onError: () => toast.error('Failed to add category'),
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/retail/expense-categories/${id}`),
    onSuccess: () => {
      toast.success('Category deleted')
      qc.invalidateQueries({ queryKey: ['expense-categories-settings'] })
      qc.invalidateQueries({ queryKey: ['expense-categories'] })
      setDeleteCatId(null)
    },
    onError: (e: unknown) => toast.error(String((e as { message?: string })?.message ?? 'Failed to delete')),
  })

  const addTypeMutation = useMutation({
    mutationFn: (typeName: string) => api.post('/api/hr/employee-types', { typeName }),
    onSuccess: () => {
      toast.success('Employee type added')
      qc.invalidateQueries({ queryKey: ['employee-types-settings'] })
      qc.invalidateQueries({ queryKey: ['employee-types'] })
      setNewTypeName('')
    },
    onError: () => toast.error('Failed to add employee type'),
  })

  const deleteTypeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/hr/employee-types/${id}`),
    onSuccess: () => {
      toast.success('Employee type deleted')
      qc.invalidateQueries({ queryKey: ['employee-types-settings'] })
      qc.invalidateQueries({ queryKey: ['employee-types'] })
      setDeleteTypeId(null)
    },
    onError: () => toast.error('Cannot delete this type'),
  })

  const companies: Array<{ id: string; code: string; name: string; currency: string; isActive: boolean; _count: { branches: number } }> = batchData?.companies ?? []
  const branches: Array<{ id: string; companyId: string; code: string; name: string; city: string | null; isHead: boolean; company: { name: string } }> = batchData?.branches ?? []

  const addCompanyMutation = useMutation({
    mutationFn: (d: typeof companyForm) => api.post('/api/settings/companies', d),
    onSuccess: () => { toast.success('Company added'); qc.invalidateQueries({ queryKey: ['companies'] }); setCompanyForm({ code: '', name: '', legalName: '', taxId: '', currency: 'GBP', address: '', phone: '', email: '' }) },
    onError: () => toast.error('Failed to add company'),
  })

  const addBranchMutation = useMutation({
    mutationFn: (d: typeof branchForm) => api.post('/api/settings/branches', d),
    onSuccess: () => { toast.success('Branch added'); qc.invalidateQueries({ queryKey: ['branches'] }); setBranchForm({ companyId: '', code: '', name: '', address: '', city: '', phone: '', email: '', isHead: false }) },
    onError: () => toast.error('Failed to add branch'),
  })

  type NumberingSeries = { id: string; module: string; prefix: string; suffix: string | null; nextNumber: number; padding: number; resetAnnually: boolean; isDefault: boolean; company: { name: string } | null }
  const numSeries: NumberingSeries[] = batchData?.numberingSeries ?? []
  const addNumMutation = useMutation({
    mutationFn: (d: typeof numForm) => api.post('/api/settings/numbering-series', d),
    onSuccess: () => { toast.success('Series created'); qc.invalidateQueries({ queryKey: ['numbering-series'] }); setNumForm({ module: '', prefix: '', suffix: '', nextNumber: 1, padding: 5, resetAnnually: false, isDefault: false }) },
    onError: () => toast.error('Failed to create series'),
  })
  const patchNumMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editNumForm }) => api.patch(`/api/settings/numbering-series/${id}`, data),
    onSuccess: () => { toast.success('Series updated'); qc.invalidateQueries({ queryKey: ['numbering-series'] }); setEditNumId(null) },
    onError: () => toast.error('Failed to update'),
  })
  const deleteNumMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/settings/numbering-series/${id}`),
    onSuccess: () => { toast.success('Series deleted'); qc.invalidateQueries({ queryKey: ['numbering-series'] }) },
    onError: () => toast.error('Failed to delete'),
  })

  type Permission = { id: string; module: string; action: string; description: string | null }
  type CustomRole = { id: string; name: string; description: string | null; isActive: boolean; submodules: Record<string, string[]>; permissions: { scope: string | null; permission: Permission }[]; _count: { userRoles: number } }
  const permissions: Permission[] = batchData?.permissions ?? []
  const roles: CustomRole[] = batchData?.roles ?? []
  const rolesLoading = batchLoading
  const roleInvalidate = () => {
    qc.invalidateQueries({ queryKey: ['custom-roles'] })
    qc.invalidateQueries({ queryKey: ['settings-init'] })
  }
  const addRoleMutation = useMutation({
    mutationFn: (d: typeof roleForm) => api.post('/api/settings/roles', d),
    onSuccess: () => { toast.success('Role created'); roleInvalidate(); setRoleForm({ name: '', description: '', permissionIds: [], submodules: {} }) },
    onError: () => toast.error('Failed to create role'),
  })
  const toggleRoleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/api/settings/roles/${id}`, { isActive }),
    onSuccess: () => { roleInvalidate() },
    onError: () => toast.error('Failed'),
  })
  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/settings/roles/${id}`),
    onSuccess: () => { toast.success('Role deleted'); roleInvalidate() },
    onError: () => toast.error('Cannot delete role — it may have users assigned'),
  })
  const updateRoleMetaMutation = useMutation({
    mutationFn: ({ id, name, description }: { id: string; name: string; description: string }) =>
      api.patch(`/api/settings/roles/${id}`, { name, description }),
    onSuccess: () => { toast.success('Role updated'); roleInvalidate(); setEditRoleId(null); setExpandedRole(null) },
    onError: () => toast.error('Failed to update role'),
  })
  const toggleModuleMutation = useMutation({
    mutationFn: ({ roleId, module, enable }: { roleId: string; module: string; enable: boolean }) => {
      const modulePerms = permissions.filter((p) => p.module === module)
      return api.patch(`/api/settings/roles/${roleId}`, enable
        ? { addPermissions: modulePerms.map((p) => ({ permissionId: p.id, scope: 'organization' })) }
        : { removePermissionIds: modulePerms.map((p) => p.id) })
    },
    onSuccess: () => roleInvalidate(),
    onError: () => toast.error('Failed to update module access'),
  })
  const updateSubmodulesMutation = useMutation({
    mutationFn: ({ roleId, module, submodules }: { roleId: string; module: string; submodules: string[] }) =>
      api.patch(`/api/settings/roles/${roleId}`, { submodules: { [module]: submodules } }),
    onSuccess: () => roleInvalidate(),
    onError: () => toast.error('Failed to update sub-modules'),
  })
  const permModules = Array.from(new Set(permissions.map((p) => p.module)))

  const SUBMODULE_MAP: Record<string, { key: string; label: string }[]> = {
    procurement: [
      { key: 'procurement', label: 'Dashboard' },
      { key: 'purchase-requests', label: 'Purchase Requests' },
      { key: 'approval-center', label: 'Approval Center' },
      { key: 'rfqs', label: 'RFQs' },
      { key: 'supplier-quotations', label: 'Quotations' },
      { key: 'purchase-orders', label: 'Purchase Orders' },
      { key: 'goods-receipt', label: 'Goods Receipt' },
      { key: 'purchase-invoices', label: 'Invoices' },
      { key: 'vendor-payments', label: 'Payments' },
      { key: 'returns', label: 'Returns' },
      { key: 'vendors', label: 'Suppliers' },
      { key: 'supplier-contacts', label: 'Contacts' },
      { key: 'supplier-ratings', label: 'Ratings' },
      { key: 'reports', label: 'Reports' },
    ],
    inventory: [
      { key: 'items', label: 'Items' },
      { key: 'warehouses', label: 'Warehouses' },
      { key: 'stock-ledger', label: 'Stock Ledger' },
      { key: 'batches', label: 'Batch Tracking' },
      { key: 'transfers', label: 'Transfers' },
      { key: 'cycle-counts', label: 'Cycle Counts' },
      { key: 'valuation', label: 'Valuation' },
      { key: 'serial-numbers', label: 'Serial Numbers' },
      { key: 'uom', label: 'Units of Measure' },
      { key: 'variants', label: 'Item Variants' },
    ],
    fulfillment: [
      { key: 'fulfillment', label: 'Dashboard' },
      { key: 'orders', label: 'Fulfillment Orders' },
      { key: 'deliveries', label: 'Deliveries' },
      { key: 'pickups', label: 'Pickups' },
      { key: 'courier', label: 'Courier' },
      { key: 'vehicles', label: 'Vehicles' },
      { key: 'drivers', label: 'Drivers' },
      { key: 'returns', label: 'Returns' },
      { key: 'settings', label: 'Settings' },
    ],
    finance: [
      { key: 'finance', label: 'Dashboard' },
      { key: 'bank-accounts', label: 'Bank Accounts' },
      { key: 'journal', label: 'Journal Entries' },
      { key: 'reports', label: 'Financial Reports' },
      { key: 'bank-reconciliation', label: 'Bank Reconciliation' },
    ],
    hr: [
      { key: 'employees', label: 'Employees' },
      { key: 'attendance', label: 'Attendance' },
      { key: 'payroll', label: 'Payroll' },
      { key: 'recruitment', label: 'Recruitment' },
    ],
    workflow: [
      { key: 'workflow', label: 'Approval Queue' },
      { key: 'definitions', label: 'Definitions' },
    ],
    reports: [
      { key: 'reports', label: 'Standard Reports' },
      { key: 'builder', label: 'Report Builder' },
    ],
  }

  const MODULE_CONFIG: Record<string, { label: string; color: string }> = {
    dashboard:     { label: 'Dashboard',     color: 'bg-slate-500' },
    crm:           { label: 'CRM',           color: 'bg-violet-500' },
    customers:     { label: 'Customers',     color: 'bg-blue-500' },
    vendors:       { label: 'Vendors',       color: 'bg-cyan-500' },
    sales:         { label: 'Sales',         color: 'bg-emerald-500' },
    procurement:   { label: 'Procurement',   color: 'bg-teal-500' },
    inventory:     { label: 'Inventory',     color: 'bg-orange-500' },
    finance:       { label: 'Finance',       color: 'bg-green-600' },
    hr:            { label: 'HR',            color: 'bg-pink-500' },
    payroll:       { label: 'Payroll',       color: 'bg-rose-500' },
    pos:           { label: 'POS',           color: 'bg-amber-500' },
    documents:     { label: 'Documents',     color: 'bg-yellow-600' },
    tasks:         { label: 'Tasks',         color: 'bg-indigo-500' },
    reports:       { label: 'Reports',       color: 'bg-purple-500' },
    insights:      { label: 'Insights',      color: 'bg-fuchsia-500' },
    notifications: { label: 'Notifications', color: 'bg-sky-500' },
    workflow:      { label: 'Workflow',      color: 'bg-lime-600' },
    audit:         { label: 'Audit',         color: 'bg-red-500' },
    users:         { label: 'Users',         color: 'bg-blue-700' },
    roles:         { label: 'Roles',         color: 'bg-violet-700' },
    permissions:   { label: 'Permissions',   color: 'bg-purple-700' },
    settings:      { label: 'Settings',      color: 'bg-gray-600' },
    fulfillment:   { label: 'Fulfillment',   color: 'bg-indigo-500' },
  }

  type PaymentTerm = { id: string; code: string; name: string; type: string; netDays: number; discountDays: number | null; discountPct: string | null; description: string | null; isActive: boolean }
  const paymentTerms: PaymentTerm[] = batchData?.paymentTerms ?? []
  const addPtMutation = useMutation({
    mutationFn: (d: typeof ptForm) => api.post('/api/settings/payment-terms', {
      ...d,
      netDays: Number(d.netDays),
      discountDays: d.discountDays ? Number(d.discountDays) : null,
      discountPct: d.discountPct ? Number(d.discountPct) : null,
    }),
    onSuccess: () => {
      toast.success('Payment term created')
      qc.invalidateQueries({ queryKey: ['payment-terms'] })
      setPtForm({ code: '', name: '', type: 'NET_DAYS', netDays: 30, discountDays: '', discountPct: '', description: '', isActive: true })
    },
    onError: () => toast.error('Failed to create payment term'),
  })
  const togglePtMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/api/settings/payment-terms/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-terms'] }),
  })
  const deletePtMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/settings/payment-terms/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['payment-terms'] }) },
    onError: () => toast.error('Cannot delete — may be in use'),
  })

  // ── Security policy ──────────────────────────────────────────────────────
  const securityPolicy = batchData?.securityPolicy
  useEffect(() => {
    if (securityPolicy) {
      setSecurityForm({
        maxLoginAttempts: securityPolicy.maxLoginAttempts,
        lockoutDurationMins: securityPolicy.lockoutDurationMins,
        sessionTimeoutMins: securityPolicy.sessionTimeoutMins,
        passwordMinLength: securityPolicy.passwordMinLength,
        passwordRequireUpper: securityPolicy.passwordRequireUpper,
        passwordRequireNumber: securityPolicy.passwordRequireNumber,
        passwordRequireSpecial: securityPolicy.passwordRequireSpecial,
        mfaRequired: securityPolicy.mfaRequired,
      })
    }
  }, [securityPolicy])
  const securityMutation = useMutation({
    mutationFn: (d: typeof securityForm) => api.put('/api/settings/security', d),
    onSuccess: () => { toast.success('Security policy updated'); qc.invalidateQueries({ queryKey: ['security-policy'] }) },
    onError: () => toast.error('Failed to update security policy'),
  })

  // ── Notification templates ───────────────────────────────────────────────
  const notificationTemplates: NotificationTemplate[] = batchData?.notificationTemplates ?? []
  const addTemplateMutation = useMutation({
    mutationFn: (d: typeof templateForm) => api.post('/api/settings/notification-templates', d),
    onSuccess: () => {
      toast.success('Notification template created')
      qc.invalidateQueries({ queryKey: ['notification-templates'] })
      setTemplateForm({ code: '', title: '', bodyTemplate: '', channel: 'IN_APP', type: 'INFO' })
    },
    onError: () => toast.error('Failed to create template'),
  })
  const toggleTemplateMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/api/settings/notification-templates/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-templates'] }),
  })
  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/settings/notification-templates/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['notification-templates'] }) },
  })

  // ── Workflow definitions ─────────────────────────────────────────────────
  const workflowDefinitions: WorkflowDefinition[] = batchData?.workflowDefinitions ?? []
  const addWorkflowMutation = useMutation({
    mutationFn: (d: typeof workflowForm) => api.post('/api/workflow/definitions', {
      name: d.name,
      module: d.module,
      isActive: true,
      steps: [{
        stepOrder: 1,
        name: 'Approval',
        approverRole: d.approverRole || undefined,
        escalateAfterHours: d.escalateAfterHours ? Number(d.escalateAfterHours) : undefined,
      }],
    }),
    onSuccess: () => {
      toast.success('Workflow created')
      qc.invalidateQueries({ queryKey: ['workflow-definitions'] })
      setWorkflowForm({ name: '', module: '', approverRole: '', escalateAfterHours: '' })
    },
    onError: () => toast.error('Failed to create workflow'),
  })

  // ── General / Appearance ──────────────────────────────────────────────────
  const GENERAL_DEFAULTS = {
    theme: 'light', language: 'en', dateFormat: 'MM/DD/YYYY', timezone: 'UTC',
    compactTables: false, stickySidebar: true, animationsEnabled: true,
  }
  const [generalForm, setGeneralForm] = useState(GENERAL_DEFAULTS)
  const [generalBaseline, setGeneralBaseline] = useState(GENERAL_DEFAULTS)
  useEffect(() => {
    if (settings) {
      const next = {
        theme: (settings.theme as string) ?? GENERAL_DEFAULTS.theme,
        language: (settings.language as string) ?? GENERAL_DEFAULTS.language,
        dateFormat: (settings.dateFormat as string) ?? GENERAL_DEFAULTS.dateFormat,
        timezone: (settings.timezone as string) ?? GENERAL_DEFAULTS.timezone,
        compactTables: (settings.compactTables as boolean) ?? GENERAL_DEFAULTS.compactTables,
        stickySidebar: (settings.stickySidebar as boolean) ?? GENERAL_DEFAULTS.stickySidebar,
        animationsEnabled: (settings.animationsEnabled as boolean) ?? GENERAL_DEFAULTS.animationsEnabled,
      }
      setGeneralForm(next)
      setGeneralBaseline(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])
  const isGeneralDirty = JSON.stringify(generalForm) !== JSON.stringify(generalBaseline)
  const generalMutation = useMutation({
    mutationFn: (d: typeof generalForm) => api.put('/api/settings', d),
    onSuccess: () => {
      toast.success('General settings saved')
      setGeneralBaseline(generalForm)
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['settings-init'] })
    },
    onError: () => toast.error('Failed to save general settings'),
  })
  const isSecurityDirty = JSON.stringify(securityForm) !== JSON.stringify(
    securityPolicy ? {
      maxLoginAttempts: securityPolicy.maxLoginAttempts, lockoutDurationMins: securityPolicy.lockoutDurationMins,
      sessionTimeoutMins: securityPolicy.sessionTimeoutMins, passwordMinLength: securityPolicy.passwordMinLength,
      passwordRequireUpper: securityPolicy.passwordRequireUpper, passwordRequireNumber: securityPolicy.passwordRequireNumber,
      passwordRequireSpecial: securityPolicy.passwordRequireSpecial, mfaRequired: securityPolicy.mfaRequired,
    } : securityForm
  )



  const filteredCategories = SETTINGS_CATEGORIES.filter((c) => {
    if (!settingsSearch) return true
    const q = settingsSearch.toLowerCase()
    return c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q))
  })
  const groupedCategories = (['Core', 'Operations', 'System'] as const).map((group) => ({
    group, items: filteredCategories.filter((c) => c.group === group),
  })).filter((g) => g.items.length > 0)
  return (
    <div className="space-y-6 pb-16">
      <PageHeader title="Settings" description="Manage ERP configuration — your system control center" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-5 sm:flex-row">
          {/* Category sidebar */}
          <div className="w-full shrink-0 space-y-3 sm:w-64">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search settings..."
                value={settingsSearch}
                onChange={(e) => setSettingsSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
              {settingsSearch && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSettingsSearch('')}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <TabsList className="flex h-auto w-full flex-col items-stretch gap-3 bg-transparent p-0">
              <TabsTrigger value="home" className="w-full justify-start gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium data-[state=active]:border-border data-[state=active]:bg-muted data-[state=active]:shadow-none">
                <Home className="h-3.5 w-3.5" />Home
              </TabsTrigger>
              {groupedCategories.map(({ group, items }) => (
                <div key={group} className="space-y-1">
                  <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">{group}</p>
                  {items.map((c) => (
                    <TabsTrigger key={c.value} value={c.value} className="w-full justify-start gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium data-[state=active]:border-border data-[state=active]:bg-muted data-[state=active]:shadow-none">
                      <c.icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.label}</span>
                    </TabsTrigger>
                  ))}
                </div>
              ))}
              {filteredCategories.length === 0 && (
                <p className="px-2.5 text-xs text-muted-foreground">No settings match &ldquo;{settingsSearch}&rdquo;</p>
              )}
            </TabsList>
            <Separator />
            <Link href="/audit" className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <RefreshCw className="h-3.5 w-3.5" />Audit Logs
              <ArrowRight className="ml-auto h-3 w-3" />
            </Link>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 space-y-4">

        <TabsContent value="home">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SETTINGS_CATEGORIES.map((c) => (
              <button key={c.value} onClick={() => setActiveTab(c.value)} className="text-left">
                <Card className="h-full border-border/60 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
                  <CardContent className="flex flex-col gap-2 pt-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      <c.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold">{c.label}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="company">
          <Card>
            <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit((d) => settingsMutation.mutate(d))} className="space-y-4">
                <div className="flex items-center gap-4 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-white">
                    {watch('logo') ? (
                      <img src={watch('logo')} alt="Logo preview" className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label>Logo URL</Label>
                    <Input {...register('logo')} placeholder="https://example.com/logo.png" />
                    <p className="text-xs text-muted-foreground">Shown in the sidebar, the login page, and on generated documents.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    { name: 'name', label: 'Company Name' },
                    { name: 'legalName', label: 'Legal Name' },
                    { name: 'email', label: 'Email', type: 'email' },
                    { name: 'phone', label: 'Phone' },
                    { name: 'website', label: 'Website' },
                    { name: 'taxId', label: 'Tax ID / VAT' },
                    { name: 'address', label: 'Address' },
                    { name: 'city', label: 'City' },
                    { name: 'country', label: 'Country' },
                  ].map(({ name, label, type }) => (
                    <div key={name} className="space-y-1">
                      <Label>{label}</Label>
                      <Input {...register(name)} type={type} />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label>Currency</Label>
                    <Select
                      value={selectedCurrency || 'GBP'}
                      onValueChange={(v) => {
                        setValue('currency', v, { shouldDirty: true })
                        setValue('currencySymbol', CURRENCY_META[v]?.symbol ?? '', { shouldDirty: true })
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_CURRENCIES.map((code) => (
                          <SelectItem key={code} value={code}>{code} — {CURRENCY_META[code].name} ({CURRENCY_META[code].symbol})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Applies to every screen in the ERP — dashboards, invoices, reports, and more.</p>
                  </div>
                </div>
                <Button type="submit" disabled={settingsMutation.isPending}>
                  {settingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <div className="space-y-4">
            {/* Create user */}
            <Card>
              <CardHeader><CardTitle>Create User</CardTitle><CardDescription>Add a new user and assign their role — a personalised dashboard is generated automatically</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Full Name *</Label>
                    <Input placeholder="John Smith" value={userForm.name} onChange={(e) => setUserForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email *</Label>
                    <Input type="email" placeholder="john@company.com" value={userForm.email} onChange={(e) => setUserForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Password *</Label>
                    <Input type="password" placeholder="Minimum 8 characters" value={userForm.password} onChange={(e) => setUserForm(f => ({ ...f, password: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Role</Label>
                    <Select value={userForm.customRoleId} onValueChange={(v) => setUserForm(f => ({ ...f, customRoleId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.filter((r) => r.isActive).map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                            {r.description && <span className="ml-1 text-xs text-muted-foreground">— {r.description}</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {userForm.customRoleId && (() => {
                      const selected = roles.find((r) => r.id === userForm.customRoleId)
                      return selected ? (
                        <p className="text-xs text-muted-foreground">{selected.permissions.length} permission{selected.permissions.length !== 1 ? 's' : ''} → {selected.permissions.length} dashboard widgets will be enabled</p>
                      ) : null
                    })()}
                  </div>
                </div>
                <Button
                  disabled={!userForm.name || !userForm.email || !userForm.password || createUserMutation.isPending}
                  onClick={() => createUserMutation.mutate(userForm)}
                >
                  <Plus className="h-4 w-4 mr-1" />Create User
                </Button>
              </CardContent>
            </Card>

            {/* User list with inline dashboard editor */}
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>{(users ?? []).length} user{(users ?? []).length !== 1 ? 's' : ''} registered</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Last Login</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Created</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersLoading ? (
                        [...Array(4)].map((_, i) => (
                          <tr key={i}>
                            <td colSpan={7} className="px-4 py-3">
                              <div className="h-8 animate-pulse rounded bg-gray-100" />
                            </td>
                          </tr>
                        ))
                      ) : (users ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                            No users yet. Create one above.
                          </td>
                        </tr>
                      ) : (users ?? []).map((u) => (
                        <React.Fragment key={u.id}>
                            <tr className="border-b hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                  {(u.name ?? u.email).charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium truncate max-w-[140px]">{u.name ?? '—'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[180px]">{u.email}</td>
                            <td className="px-4 py-3">
                              {u.userRoles?.[0]?.customRole
                                ? <Badge variant="secondary">{u.userRoles[0].customRole.name}</Badge>
                                : <span className="text-xs text-muted-foreground">No role</span>}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={u.isActive ? 'success' : 'secondary'}>
                                {u.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                              {u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                              {formatDate(u.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5 justify-end">
                                <Button
                                  size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                                  onClick={() => {
                                    if (editUserId === u.id) { setEditUserId(null); return }
                                    setEditUserId(u.id)
                                    setDashboardUserId(null)
                                    setEditUserForm({
                                      name: u.name ?? '',
                                      email: u.email,
                                      password: '',
                                      customRoleId: u.userRoles?.[0]?.customRole?.id ?? '',
                                    })
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                  {editUserId === u.id ? 'Cancel' : 'Edit'}
                                </Button>
                                <Button
                                  size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                                  onClick={() => { setDashboardUserId(dashboardUserId === u.id ? null : u.id); setEditUserId(null) }}
                                >
                                  <LayoutDashboard className="h-3 w-3" />
                                  {dashboardUserId === u.id ? 'Close' : 'Dashboard'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={u.isActive ? 'destructive' : 'outline'}
                                  className="h-7 px-2 text-xs"
                                  onClick={() => toggleUserMutation.mutate({ id: u.id, isActive: !u.isActive })}
                                >
                                  {u.isActive ? 'Deactivate' : 'Activate'}
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {/* Inline edit row */}
                          {editUserId === u.id && (
                            <tr key={`${u.id}-edit`}>
                              <td colSpan={7} className="bg-blue-50/40 border-b px-6 py-4">
                                <div className="space-y-3">
                                  <p className="text-sm font-medium flex items-center gap-2">
                                    <Pencil className="h-4 w-4" />
                                    Edit User — {u.name ?? u.email}
                                  </p>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium">Full Name</label>
                                      <Input
                                        className="h-8 text-sm"
                                        value={editUserForm.name}
                                        onChange={(e) => setEditUserForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="Full name"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium">Email</label>
                                      <Input
                                        className="h-8 text-sm"
                                        type="email"
                                        value={editUserForm.email}
                                        onChange={(e) => setEditUserForm(f => ({ ...f, email: e.target.value }))}
                                        placeholder="Email address"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium">New Password <span className="text-muted-foreground">(leave blank to keep)</span></label>
                                      <Input
                                        className="h-8 text-sm"
                                        type="password"
                                        value={editUserForm.password}
                                        onChange={(e) => setEditUserForm(f => ({ ...f, password: e.target.value }))}
                                        placeholder="New password"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium">Role</label>
                                      <Select value={editUserForm.customRoleId} onValueChange={(v) => setEditUserForm(f => ({ ...f, customRoleId: v }))}>
                                        <SelectTrigger className="h-8 text-sm">
                                          <SelectValue placeholder="Select role…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="">— No role —</SelectItem>
                                          {roles.filter((r) => r.isActive).map((r) => (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      disabled={!editUserForm.name || !editUserForm.email || updateUserMutation.isPending}
                                      onClick={() => updateUserMutation.mutate({ id: u.id, data: editUserForm })}
                                    >
                                      Save Changes
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setEditUserId(null)}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}

                          {/* Inline dashboard editor — full-width row beneath */}
                          {dashboardUserId === u.id && (
                            <tr key={`${u.id}-dashboard`}>
                              <td colSpan={7} className="bg-muted/10 border-b">
                                <div className="px-6 py-4 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium flex items-center gap-2">
                                      <LayoutDashboard className="h-4 w-4" />
                                      Dashboard — {u.name ?? u.email}
                                    </p>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                                        disabled={regenerateDashboardMutation.isPending}
                                        onClick={() => regenerateDashboardMutation.mutate(u.id)}
                                      >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Regenerate from Role
                                      </Button>
                                      <Button
                                        size="sm" className="h-7 px-2 text-xs"
                                        disabled={saveDashboardMutation.isPending || localWidgets.length === 0}
                                        onClick={() => saveDashboardMutation.mutate({ userId: u.id, widgets: localWidgets })}
                                      >
                                        Save Dashboard
                                      </Button>
                                    </div>
                                  </div>

                                  {dashboardLoading ? (
                                    <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />)}</div>
                                  ) : localWidgets.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No widgets. Assign a role first, then click &quot;Regenerate from Role&quot;.</p>
                                  ) : (
                                    <div className="rounded-md border overflow-hidden bg-white">
                                      <table className="w-full text-xs">
                                        <thead className="bg-muted/50">
                                          <tr>
                                            <th className="px-3 py-2 text-left font-medium w-8">#</th>
                                            <th className="px-3 py-2 text-left font-medium">Widget</th>
                                            <th className="px-3 py-2 text-left font-medium">Module</th>
                                            <th className="px-3 py-2 text-left font-medium">Type</th>
                                            <th className="px-3 py-2 text-center font-medium">Visible</th>
                                            <th className="px-3 py-2 text-center font-medium w-16">Move</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                          {localWidgets.map((w, idx) => (
                                            <tr key={w.id} className={`hover:bg-muted/20 ${!w.visible ? 'opacity-40' : ''}`}>
                                              <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                                              <td className="px-3 py-2 font-medium">{w.title}</td>
                                              <td className="px-3 py-2 capitalize text-muted-foreground">{w.module}</td>
                                              <td className="px-3 py-2 capitalize text-muted-foreground">{w.type}</td>
                                              <td className="px-3 py-2 text-center">
                                                <button
                                                  onClick={() => setLocalWidgets((prev) =>
                                                    prev.map((x) => x.id === w.id ? { ...x, visible: !x.visible } : x)
                                                  )}
                                                  className="inline-flex items-center justify-center"
                                                >
                                                  {w.visible
                                                    ? <Eye className="h-3.5 w-3.5 text-green-600" />
                                                    : <EyeOff className="h-3.5 w-3.5 text-gray-400" />}
                                                </button>
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                <div className="flex justify-center gap-0.5">
                                                  <button disabled={idx === 0} className="disabled:opacity-30"
                                                    onClick={() => setLocalWidgets((prev) => {
                                                      const next = [...prev]
                                                      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                                                      return next.map((x, i) => ({ ...x, order: i }))
                                                    })}>
                                                    <ChevronUp className="h-3.5 w-3.5" />
                                                  </button>
                                                  <button disabled={idx === localWidgets.length - 1} className="disabled:opacity-30"
                                                    onClick={() => setLocalWidgets((prev) => {
                                                      const next = [...prev]
                                                      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
                                                      return next.map((x, i) => ({ ...x, order: i }))
                                                    })}>
                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Toggle visibility to hide widgets; reorder to set priority. Changes take effect when the user next loads their dashboard.
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                      </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Store Profile ─────────────────────────────────────────────── */}
        <TabsContent value="store">
          <Card>
            <CardHeader>
              <CardTitle>Store Profile</CardTitle>
              <CardDescription>Store name, address, and VAT registration details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={hsStore((d) => storeMutation.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Store Name *</Label>
                    <Input {...regStore('storeName')} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Store Address</Label>
                    <Input {...regStore('storeAddress')} placeholder="Full postal address" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>VAT Registration Number</Label>
                    <Input {...regStore('vatRegistrationNumber')} placeholder="e.g. GB123456789" />
                  </div>
                </div>

                <Separator />
                <p className="text-sm font-medium text-gray-700">VAT Quarter Start Months</p>
                <p className="text-xs text-gray-500">Enter month numbers (1–12) for your four VAT quarter start dates</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {([1, 2, 3, 4] as const).map((n) => (
                    <div key={n} className="space-y-1">
                      <Label>Quarter {n}</Label>
                      <Input
                        {...regStore(`vatQuarterMonth${n}` as 'vatQuarterMonth1' | 'vatQuarterMonth2' | 'vatQuarterMonth3' | 'vatQuarterMonth4', { valueAsNumber: true })}
                        type="number" min={1} max={12}
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={storeMutation.isPending}>
                    {storeMutation.isPending ? 'Saving…' : 'Save Store Profile'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── VAT & Loyalty ─────────────────────────────────────────────── */}
        <TabsContent value="vat">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>VAT Configuration</CardTitle>
                <CardDescription>Default VAT rates by product category (enter as decimal, e.g. 0.20 for 20%)</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={hsStore((d) => storeMutation.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { name: 'defaultVatGroceries', label: 'Groceries (zero-rated)' },
                      { name: 'defaultVatToiletries', label: 'Toiletries' },
                      { name: 'defaultVatClothing', label: 'Clothing' },
                      { name: 'defaultVatElectronics', label: 'Electronics' },
                    ].map(({ name, label }) => (
                      <div key={name} className="space-y-1">
                        <Label>{label}</Label>
                        <Input
                          {...regStore(name as keyof StoreSettings)}
                          type="number" step="0.01" min="0" max="1"
                          placeholder="0.20"
                        />
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <p className="text-sm font-medium text-gray-700">Loyalty Programme</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Points per £1 Spent</Label>
                      <Input
                        {...regStore('loyaltyPointsPerPound', { valueAsNumber: true })}
                        type="number" min={0}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Points Needed for £1 Redemption</Label>
                      <Input
                        {...regStore('loyaltyRedemptionRate', { valueAsNumber: true })}
                        type="number" min={1}
                      />
                    </div>
                  </div>
                  <Separator />
                  <p className="text-sm font-medium text-gray-700">Wage Cost Target</p>
                  <div className="max-w-xs space-y-1">
                    <Label>Target Wage Cost % of Revenue</Label>
                    <Input
                      {...regStore('wageCostTargetPct')}
                      type="number" step="0.01" min="0" max="100"
                      placeholder="25.00"
                    />
                    <p className="text-xs text-gray-500">Shown on dashboard KPI. Typical UK retail: 20–30%</p>
                  </div>
                  <Button type="submit" disabled={storeMutation.isPending}>
                    {storeMutation.isPending ? 'Saving…' : 'Save VAT & Loyalty'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Compliance Alerts ─────────────────────────────────────────── */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Alerts</CardTitle>
              <CardDescription>Enable or disable automated compliance notifications shown on the dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={hsStore((d) => storeMutation.mutate(d))} className="space-y-5">
                {[
                  { name: 'alertFefo7Day', label: 'FEFO Expiry Alert (≤7 days)', description: 'Warn when batches expire within 7 days' },
                  { name: 'alertLowStock', label: 'Low Stock Alert', description: 'Notify when product stock falls below reorder level' },
                  { name: 'alertVisaExpiry', label: 'Visa / Right-to-Work Expiry', description: 'Flag employees with visas expiring within 45 days' },
                  { name: 'alertWtdBreach', label: 'Working Time Directive Breach', description: 'Alert when employees exceed 48h average weekly hours' },
                ].map(({ name, label, description }) => (
                  <div key={name} className="flex items-start gap-3">
                    <input
                      {...regStore(name as keyof StoreSettings)}
                      type="checkbox"
                      id={name}
                      className="mt-1 h-4 w-4 rounded border-gray-300 accent-indigo-600 cursor-pointer"
                    />
                    <div>
                      <label htmlFor={name} className="text-sm font-medium cursor-pointer">{label}</label>
                      <p className="text-xs text-gray-500">{description}</p>
                    </div>
                  </div>
                ))}
                <Button type="submit" disabled={storeMutation.isPending}>
                  {storeMutation.isPending ? 'Saving…' : 'Save Alert Settings'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ── Expense Categories ────────────────────────────────────────── */}
        <TabsContent value="expense-categories">
          <Card>
            <CardHeader>
              <CardTitle>Expense Categories</CardTitle>
              <CardDescription>Manage categories used when recording expenses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="New category name…"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newCatName.trim()) addCategoryMutation.mutate(newCatName.trim()) }}
                  className="max-w-xs"
                />
                <Button
                  onClick={() => newCatName.trim() && addCategoryMutation.mutate(newCatName.trim())}
                  disabled={!newCatName.trim() || addCategoryMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-1" />Add
                </Button>
              </div>
              <div className="divide-y rounded-md border">
                {expenseCategories.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No categories yet.</p>
                )}
                {expenseCategories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between px-4 py-2">
                    <span className="text-sm font-medium">{cat.categoryName}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => setDeleteCatId(cat.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <ConfirmDialog
            open={deleteCatId !== null}
            title="Delete Expense Category"
            description="This will permanently delete the category. It cannot be deleted if expenses are using it."
            onConfirm={() => deleteCatId !== null && deleteCategoryMutation.mutate(deleteCatId)}
            onClose={() => setDeleteCatId(null)}
            loading={deleteCategoryMutation.isPending}
          />
        </TabsContent>

        {/* ── Employee Types ─────────────────────────────────────────────── */}
        <TabsContent value="employee-types">
          <Card>
            <CardHeader>
              <CardTitle>Employee Types</CardTitle>
              <CardDescription>Add custom employment types (e.g. Daily Wages, Zero Hours, Seasonal) alongside the built-in types</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="New employee type name…"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newTypeName.trim()) addTypeMutation.mutate(newTypeName.trim()) }}
                  className="max-w-xs"
                />
                <Button
                  onClick={() => newTypeName.trim() && addTypeMutation.mutate(newTypeName.trim())}
                  disabled={!newTypeName.trim() || addTypeMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-1" />Add
                </Button>
              </div>
              <div className="divide-y rounded-md border">
                {employeeTypes.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No custom employee types yet.</p>
                )}
                {employeeTypes.map((et) => (
                  <div key={et.id} className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{et.typeName}</span>
                      {et.isBuiltIn && <Badge variant="secondary" className="text-xs">Built-in</Badge>}
                    </div>
                    {!et.isBuiltIn && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => setDeleteTypeId(et.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <ConfirmDialog
            open={deleteTypeId !== null}
            title="Delete Employee Type"
            description="This will permanently delete this employee type."
            onConfirm={() => deleteTypeId !== null && deleteTypeMutation.mutate(deleteTypeId)}
            onClose={() => setDeleteTypeId(null)}
            loading={deleteTypeMutation.isPending}
          />
        </TabsContent>

        {/* ── Companies ─────────────────────────────────────────────── */}
        <TabsContent value="companies">
          <Card>
            <CardHeader><CardTitle>Companies</CardTitle><CardDescription>Multi-company entities within this ERP</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {companies.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div>
                      <span className="font-medium text-sm">{c.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">[{c.code}] · {c.currency} · {c._count.branches} branch(es)</span>
                    </div>
                    <Badge variant={c.isActive ? 'success' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                  </div>
                ))}
              </div>
              <Separator />
              <p className="text-sm font-medium">Add Company</p>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Code" value={companyForm.code} onChange={(e) => setCompanyForm(f => ({ ...f, code: e.target.value }))} />
                <Input placeholder="Name *" value={companyForm.name} onChange={(e) => setCompanyForm(f => ({ ...f, name: e.target.value }))} />
                <Input placeholder="Legal Name" value={companyForm.legalName} onChange={(e) => setCompanyForm(f => ({ ...f, legalName: e.target.value }))} />
                <Input placeholder="Tax ID / VAT" value={companyForm.taxId} onChange={(e) => setCompanyForm(f => ({ ...f, taxId: e.target.value }))} />
                <Input placeholder="Currency (GBP)" value={companyForm.currency} onChange={(e) => setCompanyForm(f => ({ ...f, currency: e.target.value }))} />
                <Input placeholder="Phone" value={companyForm.phone} onChange={(e) => setCompanyForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <Button
                disabled={!companyForm.code || !companyForm.name || addCompanyMutation.isPending}
                onClick={() => addCompanyMutation.mutate(companyForm)}
              >
                <Plus className="h-4 w-4 mr-1" />Add Company
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Branches ──────────────────────────────────────────────── */}
        <TabsContent value="branches">
          <Card>
            <CardHeader><CardTitle>Branches</CardTitle><CardDescription>Branch locations linked to a company</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {branches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div>
                      <span className="font-medium text-sm">{b.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">[{b.code}] · {b.company.name}{b.city ? ` · ${b.city}` : ''}</span>
                    </div>
                    {b.isHead && <Badge className="bg-blue-100 text-blue-800">Head Office</Badge>}
                  </div>
                ))}
              </div>
              <Separator />
              <p className="text-sm font-medium">Add Branch</p>
              <div className="grid grid-cols-2 gap-3">
                <Select value={branchForm.companyId} onValueChange={(v) => setBranchForm(f => ({ ...f, companyId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select Company *" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Code" value={branchForm.code} onChange={(e) => setBranchForm(f => ({ ...f, code: e.target.value }))} />
                <Input placeholder="Name *" value={branchForm.name} onChange={(e) => setBranchForm(f => ({ ...f, name: e.target.value }))} />
                <Input placeholder="City" value={branchForm.city} onChange={(e) => setBranchForm(f => ({ ...f, city: e.target.value }))} />
                <Input placeholder="Phone" value={branchForm.phone} onChange={(e) => setBranchForm(f => ({ ...f, phone: e.target.value }))} />
                <Input placeholder="Email" value={branchForm.email} onChange={(e) => setBranchForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={branchForm.isHead} onChange={(e) => setBranchForm(f => ({ ...f, isHead: e.target.checked }))} />
                Mark as head office
              </label>
              <Button
                disabled={!branchForm.companyId || !branchForm.code || !branchForm.name || addBranchMutation.isPending}
                onClick={() => addBranchMutation.mutate(branchForm)}
              >
                <Plus className="h-4 w-4 mr-1" />Add Branch
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ── Numbering Series ──────────────────────────────────────── */}
        <TabsContent value="numbering">
          <Card>
            <CardHeader>
              <CardTitle>Document Numbering Series</CardTitle>
              <CardDescription>Configure auto-numbering for Sales Orders, Invoices, Purchase Orders, and more</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing series */}
              {numSeries.length > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Module</th>
                        <th className="px-3 py-2 text-left">Prefix</th>
                        <th className="px-3 py-2 text-left">Suffix</th>
                        <th className="px-3 py-2 text-center">Padding</th>
                        <th className="px-3 py-2 text-center">Next #</th>
                        <th className="px-3 py-2 text-center">Reset/Yr</th>
                        <th className="px-3 py-2 text-center">Default</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {numSeries.map((s) => editNumId === s.id ? (
                        <tr key={s.id} className="bg-blue-50/30">
                          <td className="px-3 py-2 font-medium">{s.module}</td>
                          <td className="px-3 py-2"><Input className="h-7 w-24 text-xs" value={editNumForm.prefix} onChange={(e) => setEditNumForm(f => ({ ...f, prefix: e.target.value }))} /></td>
                          <td className="px-3 py-2"><Input className="h-7 w-20 text-xs" value={editNumForm.suffix} onChange={(e) => setEditNumForm(f => ({ ...f, suffix: e.target.value }))} placeholder="—" /></td>
                          <td className="px-3 py-2 text-center"><Input className="h-7 w-14 text-xs text-center" type="number" min={1} max={10} value={editNumForm.padding} onChange={(e) => setEditNumForm(f => ({ ...f, padding: parseInt(e.target.value) || 5 }))} /></td>
                          <td className="px-3 py-2 text-center"><Input className="h-7 w-16 text-xs text-center" type="number" min={1} value={editNumForm.nextNumber} onChange={(e) => setEditNumForm(f => ({ ...f, nextNumber: parseInt(e.target.value) || 1 }))} /></td>
                          <td className="px-3 py-2 text-center"><input type="checkbox" checked={editNumForm.resetAnnually} onChange={(e) => setEditNumForm(f => ({ ...f, resetAnnually: e.target.checked }))} /></td>
                          <td className="px-3 py-2 text-center">{s.isDefault ? <Badge className="bg-green-100 text-green-800">Yes</Badge> : '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" className="h-6 px-2 text-xs" onClick={() => patchNumMutation.mutate({ id: s.id, data: editNumForm })} disabled={patchNumMutation.isPending}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditNumId(null)}>Cancel</Button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={s.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium">{s.module}</td>
                          <td className="px-3 py-2 font-mono text-xs">{s.prefix}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{s.suffix ?? '—'}</td>
                          <td className="px-3 py-2 text-center">{s.padding}</td>
                          <td className="px-3 py-2 text-center">{s.nextNumber}</td>
                          <td className="px-3 py-2 text-center">{s.resetAnnually ? '✓' : '—'}</td>
                          <td className="px-3 py-2 text-center">{s.isDefault ? <Badge className="bg-green-100 text-green-800">Default</Badge> : '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditNumId(s.id); setEditNumForm({ prefix: s.prefix, suffix: s.suffix ?? '', nextNumber: s.nextNumber, padding: s.padding, resetAnnually: s.resetAnnually }) }}>Edit</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:text-red-700" onClick={() => { if (confirm('Delete this numbering series?')) deleteNumMutation.mutate(s.id) }} disabled={deleteNumMutation.isPending}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Separator />
              <p className="text-sm font-medium">Add Numbering Series</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Module *</label>
                  <Input placeholder="e.g. SO, INV, PO" value={numForm.module} onChange={(e) => setNumForm(f => ({ ...f, module: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Prefix *</label>
                  <Input placeholder="e.g. SO-" value={numForm.prefix} onChange={(e) => setNumForm(f => ({ ...f, prefix: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Suffix</label>
                  <Input placeholder="optional" value={numForm.suffix} onChange={(e) => setNumForm(f => ({ ...f, suffix: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Padding (digits)</label>
                  <Input type="number" min={1} max={10} value={numForm.padding} onChange={(e) => setNumForm(f => ({ ...f, padding: parseInt(e.target.value) || 5 }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Starting Number</label>
                  <Input type="number" min={1} value={numForm.nextNumber} onChange={(e) => setNumForm(f => ({ ...f, nextNumber: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={numForm.resetAnnually} onChange={(e) => setNumForm(f => ({ ...f, resetAnnually: e.target.checked }))} />
                  Reset counter annually
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={numForm.isDefault} onChange={(e) => setNumForm(f => ({ ...f, isDefault: e.target.checked }))} />
                  Mark as default for module
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Preview: <span className="font-mono font-medium">{numForm.prefix || 'PREFIX-'}{String(numForm.nextNumber || 1).padStart(numForm.padding || 5, '0')}{numForm.suffix || ''}</span>
              </p>
              <Button
                disabled={!numForm.module || !numForm.prefix || addNumMutation.isPending}
                onClick={() => addNumMutation.mutate(numForm)}
              >
                <Plus className="h-4 w-4 mr-1" />Add Series
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ── Roles & Permissions ───────────────────────────────────── */}
        <TabsContent value="roles">
          <div className="space-y-4">
            {/* Existing roles */}
            <Card>
              <CardHeader><CardTitle>Custom Roles</CardTitle><CardDescription>Define custom roles and assign permissions per module</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {rolesLoading ? (
                  <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />)}</div>
                ) : roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No custom roles yet.</p>
                ) : roles.map((role) => (
                  <div key={role.id} className="rounded-md border overflow-hidden">
                    {/* Role header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                      {editRoleId === role.id ? (
                        <div className="flex items-center gap-2 flex-1 mr-4">
                          <Input
                            className="h-7 text-sm w-48"
                            value={editRoleName}
                            onChange={(e) => setEditRoleName(e.target.value)}
                            placeholder="Role name"
                          />
                          <Input
                            className="h-7 text-sm flex-1"
                            value={editRoleDesc}
                            onChange={(e) => setEditRoleDesc(e.target.value)}
                            placeholder="Description (optional)"
                          />
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={!editRoleName || updateRoleMetaMutation.isPending}
                            onClick={() => updateRoleMetaMutation.mutate({ id: role.id, name: editRoleName, description: editRoleDesc })}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditRoleId(null); setExpandedRole(null) }}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            className="text-sm font-medium hover:underline text-left"
                            onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                          >
                            {role.name}
                          </button>
                          {role.description && <span className="text-xs text-muted-foreground">{role.description}</span>}
                          <Badge variant={role.isActive ? 'success' : 'secondary'}>{role.isActive ? 'Active' : 'Inactive'}</Badge>
                          <span className="text-xs text-muted-foreground">{role._count.userRoles} user{role._count.userRoles !== 1 ? 's' : ''}</span>
                          <span className="text-xs text-muted-foreground">{role.permissions.length} perm{role.permissions.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      <div className="flex gap-2 shrink-0">
                        {editRoleId !== role.id && (
                          <Button
                            size="sm" variant="outline" className="h-7 px-2 text-xs"
                            onClick={() => { setEditRoleId(role.id); setEditRoleName(role.name); setEditRoleDesc(role.description ?? ''); setExpandedRole(role.id) }}
                          >
                            Edit
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => toggleRoleActiveMutation.mutate({ id: role.id, isActive: !role.isActive })}>
                          {role.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500" onClick={() => { if (confirm(`Delete role "${role.name}"?`)) deleteRoleMutation.mutate(role.id) }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {/* Module access grid */}
                    {expandedRole === role.id && (
                      <div className="px-4 py-4 border-t space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Module Access</p>
                          <p className="text-xs text-muted-foreground">
                            {permModules.filter((m) => role.permissions.some((rp) => rp.permission.module === m)).length} / {permModules.length} modules enabled
                          </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                          {permModules.map((mod) => {
                            const cfg = MODULE_CONFIG[mod] ?? { label: mod, color: 'bg-gray-500' }
                            const enabled = role.permissions.some((rp) => rp.permission.module === mod)
                            const actionCount = permissions.filter((p) => p.module === mod).length
                            const subModules = SUBMODULE_MAP[mod]
                            const roleSubs = (role.submodules?.[mod] ?? subModules?.map((s) => s.key) ?? [])
                            return (
                              <div
                                key={mod}
                                className={`rounded-lg border p-3 transition-all ${
                                  enabled
                                    ? 'border-primary/30 bg-primary/5 shadow-sm'
                                    : 'border-dashed border-gray-200 bg-gray-50/60 opacity-60'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1 mb-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${cfg.color}`} />
                                    <span className="text-xs font-semibold truncate">{cfg.label}</span>
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={enabled}
                                    className="shrink-0 mt-0.5 cursor-pointer"
                                    disabled={toggleModuleMutation.isPending}
                                    onChange={() => toggleModuleMutation.mutate({
                                      roleId: role.id, module: mod,
                                      enable: !enabled,
                                    })}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">{actionCount} action{actionCount !== 1 ? 's' : ''}</p>
                                {enabled && (
                                  <div className="space-y-1">
                                    {subModules && (
                                      <div className="mt-1.5 pt-1.5 border-t border-border/40 space-y-0.5">
                                        {subModules.map((sm) => (
                                          <label key={sm.key} className="flex items-center gap-1.5 cursor-pointer py-0.5">
                                            <input
                                              type="checkbox"
                                              className="shrink-0 scale-75"
                                              checked={roleSubs.includes(sm.key)}
                                              disabled={updateSubmodulesMutation.isPending}
                                              onChange={() => {
                                                const next = roleSubs.includes(sm.key)
                                                  ? roleSubs.filter((k) => k !== sm.key)
                                                  : [...roleSubs, sm.key]
                                                updateSubmodulesMutation.mutate({
                                                  roleId: role.id, module: mod, submodules: next,
                                                })
                                              }}
                                            />
                                            <span className="text-[11px] text-muted-foreground">{sm.label}</span>
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Create role */}
            <Card>
              <CardHeader><CardTitle>Create Role</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Role Name *</label>
                    <Input placeholder="e.g. Accounts Manager" value={roleForm.name} onChange={(e) => setRoleForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Description</label>
                    <Input placeholder="Brief role description" value={roleForm.description} onChange={(e) => setRoleForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium mb-2">Module Access <span className="text-muted-foreground font-normal">(select sub-modules within each module for granular access)</span></p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    {permModules.map((mod) => {
                      const cfg = MODULE_CONFIG[mod] ?? { label: mod, color: 'bg-gray-500' }
                      const modPerms = permissions.filter((p) => p.module === mod)
                      const allSelected = modPerms.every((p) => roleForm.permissionIds.includes(p.id))
                      const subModules = SUBMODULE_MAP[mod]
                      const roleSubs = roleForm.submodules[mod] ?? []
                      return (
                        <div
                          key={mod}
                          className={`rounded-lg border p-3 transition-all ${
                            allSelected ? 'border-primary/30 bg-primary/5' : 'border-dashed border-gray-200 bg-gray-50/60 opacity-60'
                          }`}
                        >
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5 shrink-0"
                              checked={allSelected}
                              onChange={(e) => setRoleForm(f => ({
                                ...f,
                                permissionIds: e.target.checked
                                  ? Array.from(new Set([...f.permissionIds, ...modPerms.map((p) => p.id)]))
                                  : f.permissionIds.filter((id) => !modPerms.find((p) => p.id === id)),
                                submodules: e.target.checked
                                  ? { ...f.submodules, [mod]: subModules?.map((s) => s.key) ?? [] }
                                  : (() => { const next = { ...f.submodules }; delete next[mod]; return next })(),
                              }))}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.color}`} />
                                <span className="text-xs font-semibold truncate">{cfg.label}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{modPerms.length} actions</p>
                            </div>
                          </label>
                          {allSelected && subModules && (
                            <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                              {subModules.map((sm) => (
                                <label key={sm.key} className="flex items-center gap-1.5 cursor-pointer py-0.5">
                                  <input
                                    type="checkbox"
                                    className="shrink-0 scale-75"
                                    checked={roleSubs.includes(sm.key)}
                                    onChange={() => setRoleForm(f => {
                                      const current = f.submodules[mod] ?? []
                                      const next = current.includes(sm.key)
                                        ? current.filter((k) => k !== sm.key)
                                        : [...current, sm.key]
                                      return {
                                        ...f,
                                        submodules: next.length
                                          ? { ...f.submodules, [mod]: next }
                                          : (() => { const n = { ...f.submodules }; delete n[mod]; return n })(),
                                      }
                                    })}
                                  />
                                  <span className="text-[11px] text-muted-foreground">{sm.label}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <Button
                  disabled={!roleForm.name || addRoleMutation.isPending}
                  onClick={() => addRoleMutation.mutate(roleForm)}
                >
                  <Plus className="h-4 w-4 mr-1" />Create Role
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Payment Terms ──────────────────────────────────── */}
        <TabsContent value="payment-terms">
          <Card>
            <CardHeader>
              <CardTitle>Payment Terms</CardTitle>
              <CardDescription>Standard payment terms used on sales orders, invoices, and purchase orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentTerms.length > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Code</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-center">Net Days</th>
                        <th className="px-3 py-2 text-center">Discount Days</th>
                        <th className="px-3 py-2 text-center">Discount %</th>
                        <th className="px-3 py-2 text-center">Status</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paymentTerms.map((pt) => (
                        <tr key={pt.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono text-xs font-medium">{pt.code}</td>
                          <td className="px-3 py-2">{pt.name}</td>
                          <td className="px-3 py-2"><Badge variant="secondary" className="text-xs">{pt.type.replace(/_/g, ' ')}</Badge></td>
                          <td className="px-3 py-2 text-center">{pt.netDays}</td>
                          <td className="px-3 py-2 text-center">{pt.discountDays ?? '—'}</td>
                          <td className="px-3 py-2 text-center">{pt.discountPct ? `${pt.discountPct}%` : '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => togglePtMutation.mutate({ id: pt.id, isActive: !pt.isActive })}>
                              <Badge className={pt.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}>
                                {pt.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-500 hover:text-red-700"
                              onClick={() => { if (confirm(`Delete "${pt.name}"?`)) deletePtMutation.mutate(pt.id) }}
                              disabled={deletePtMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Separator />
              <p className="text-sm font-medium">Add Payment Term</p>
              <div className="grid grid-cols-3 gap-3 max-w-2xl">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Code *</label>
                  <Input placeholder="e.g. NET30" value={ptForm.code} onChange={(e) => setPtForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-medium">Name *</label>
                  <Input placeholder="e.g. Net 30 Days" value={ptForm.name} onChange={(e) => setPtForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Type</label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={ptForm.type} onChange={(e) => setPtForm((f) => ({ ...f, type: e.target.value }))}>
                    <option value="NET_DAYS">Net Days</option>
                    <option value="END_OF_MONTH">End of Month</option>
                    <option value="CASH_ON_DELIVERY">Cash on Delivery</option>
                    <option value="PREPAID">Prepaid</option>
                    <option value="INSTALLMENT">Installment</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Net Days</label>
                  <Input type="number" min={0} value={ptForm.netDays} onChange={(e) => setPtForm((f) => ({ ...f, netDays: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Description</label>
                  <Input placeholder="optional" value={ptForm.description} onChange={(e) => setPtForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Early Pay Days</label>
                  <Input type="number" min={0} placeholder="e.g. 10" value={ptForm.discountDays} onChange={(e) => setPtForm((f) => ({ ...f, discountDays: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Early Pay Discount %</label>
                  <Input type="number" min={0} max={100} step={0.5} placeholder="e.g. 2" value={ptForm.discountPct} onChange={(e) => setPtForm((f) => ({ ...f, discountPct: e.target.value }))} />
                </div>
              </div>
              <Button
                disabled={!ptForm.code || !ptForm.name || addPtMutation.isPending}
                onClick={() => addPtMutation.mutate(ptForm)}
              >
                <Plus className="h-4 w-4 mr-1" />Add Term
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow">
          <Card>
            <CardHeader>
              <CardTitle>Approval Workflows</CardTitle>
              <CardDescription>Configure approval chains for procurement, HR, and finance requests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {workflowDefinitions.length > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Module</th>
                        <th className="px-3 py-2 text-left">Approver Role</th>
                        <th className="px-3 py-2 text-center">Escalation</th>
                        <th className="px-3 py-2 text-center">In Progress</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {workflowDefinitions.map((w) => (
                        <tr key={w.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium">{w.name}</td>
                          <td className="px-3 py-2"><Badge variant="secondary" className="text-xs">{w.module}</Badge></td>
                          <td className="px-3 py-2">{w.steps[0]?.approverRole ?? '—'}</td>
                          <td className="px-3 py-2 text-center">{w.steps[0]?.escalateAfterHours ? `${w.steps[0].escalateAfterHours}h` : '—'}</td>
                          <td className="px-3 py-2 text-center">{w._count.instances}</td>
                          <td className="px-3 py-2 text-center">
                            <Badge className={w.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}>
                              {w.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Separator />
              <p className="text-sm font-medium">Add Approval Workflow</p>
              <div className="grid grid-cols-2 gap-3 max-w-2xl">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Name *</label>
                  <Input placeholder="e.g. Purchase Order Approval" value={workflowForm.name} onChange={(e) => setWorkflowForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Module *</label>
                  <Input placeholder="e.g. procurement" value={workflowForm.module} onChange={(e) => setWorkflowForm((f) => ({ ...f, module: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Approver Role</label>
                  <Input placeholder="e.g. MANAGER" value={workflowForm.approverRole} onChange={(e) => setWorkflowForm((f) => ({ ...f, approverRole: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Escalate After (hours)</label>
                  <Input type="number" min={0} placeholder="e.g. 24" value={workflowForm.escalateAfterHours} onChange={(e) => setWorkflowForm((f) => ({ ...f, escalateAfterHours: e.target.value }))} />
                </div>
              </div>
              <Button
                disabled={!workflowForm.name || !workflowForm.module || addWorkflowMutation.isPending}
                onClick={() => addWorkflowMutation.mutate(workflowForm)}
              >
                <Plus className="h-4 w-4 mr-1" />Add Workflow
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Templates</CardTitle>
              <CardDescription>Configure notification channels and message templates used across the ERP</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notificationTemplates.length > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Code</th>
                        <th className="px-3 py-2 text-left">Title</th>
                        <th className="px-3 py-2 text-center">Channel</th>
                        <th className="px-3 py-2 text-center">Type</th>
                        <th className="px-3 py-2 text-center">Status</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {notificationTemplates.map((t) => (
                        <tr key={t.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono text-xs font-medium">{t.code}</td>
                          <td className="px-3 py-2">{t.title}</td>
                          <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-xs">{t.channel.replace(/_/g, ' ')}</Badge></td>
                          <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-xs">{t.type}</Badge></td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => toggleTemplateMutation.mutate({ id: t.id, isActive: !t.isActive })}>
                              <Badge className={t.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}>
                                {t.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-500 hover:text-red-700"
                              onClick={() => { if (confirm(`Delete "${t.title}"?`)) deleteTemplateMutation.mutate(t.id) }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Separator />
              <p className="text-sm font-medium">Add Notification Template</p>
              <div className="grid grid-cols-2 gap-3 max-w-2xl">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Code *</label>
                  <Input placeholder="e.g. INVOICE_OVERDUE" value={templateForm.code} onChange={(e) => setTemplateForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Title *</label>
                  <Input placeholder="e.g. Invoice Overdue" value={templateForm.title} onChange={(e) => setTemplateForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-medium">Body Template *</label>
                  <Input placeholder="e.g. Invoice {{number}} is overdue" value={templateForm.bodyTemplate} onChange={(e) => setTemplateForm((f) => ({ ...f, bodyTemplate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Channel</label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={templateForm.channel} onChange={(e) => setTemplateForm((f) => ({ ...f, channel: e.target.value }))}>
                    <option value="IN_APP">In-App</option>
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="WEBHOOK">Webhook</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Type</label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={templateForm.type} onChange={(e) => setTemplateForm((f) => ({ ...f, type: e.target.value }))}>
                    <option value="INFO">Info</option>
                    <option value="WARNING">Warning</option>
                    <option value="ERROR">Error</option>
                    <option value="SUCCESS">Success</option>
                    <option value="ACTION_REQUIRED">Action Required</option>
                  </select>
                </div>
              </div>
              <Button
                disabled={!templateForm.code || !templateForm.title || !templateForm.bodyTemplate || addTemplateMutation.isPending}
                onClick={() => addTemplateMutation.mutate(templateForm)}
              >
                <Plus className="h-4 w-4 mr-1" />Add Template
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Policy</CardTitle>
              <CardDescription>Password rules, session timeout, and login protection for all users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-2xl">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Max Login Attempts</label>
                  <Input type="number" min={1} value={securityForm.maxLoginAttempts} onChange={(e) => setSecurityForm((f) => ({ ...f, maxLoginAttempts: Number(e.target.value) || 1 }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Lockout Duration (mins)</label>
                  <Input type="number" min={1} value={securityForm.lockoutDurationMins} onChange={(e) => setSecurityForm((f) => ({ ...f, lockoutDurationMins: Number(e.target.value) || 1 }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Session Timeout (mins)</label>
                  <Input type="number" min={1} value={securityForm.sessionTimeoutMins} onChange={(e) => setSecurityForm((f) => ({ ...f, sessionTimeoutMins: Number(e.target.value) || 1 }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Password Min Length</label>
                  <Input type="number" min={4} value={securityForm.passwordMinLength} onChange={(e) => setSecurityForm((f) => ({ ...f, passwordMinLength: Number(e.target.value) || 4 }))} />
                </div>
              </div>
              <Separator />
              <div className="space-y-2 max-w-2xl">
                {[
                  { key: 'passwordRequireUpper' as const, label: 'Require uppercase letter in password' },
                  { key: 'passwordRequireNumber' as const, label: 'Require number in password' },
                  { key: 'passwordRequireSpecial' as const, label: 'Require special character in password' },
                  { key: 'mfaRequired' as const, label: 'Require two-factor authentication (2FA)' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={securityForm[key]}
                      onChange={(e) => setSecurityForm((f) => ({ ...f, [key]: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <Button disabled={securityMutation.isPending} onClick={() => securityMutation.mutate(securityForm)}>
                <Save className="h-4 w-4 mr-1" />Save Security Policy
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General &amp; Appearance</CardTitle>
              <CardDescription>Theme, locale, and UI preferences that apply across the whole ERP</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-2xl">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Theme</label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={generalForm.theme} onChange={(e) => setGeneralForm((f) => ({ ...f, theme: e.target.value }))}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="professional">Professional (minimal)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Language</label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={generalForm.language} onChange={(e) => setGeneralForm((f) => ({ ...f, language: e.target.value }))}>
                    <option value="en">English</option>
                    <option value="ur">Urdu</option>
                    <option value="ar">Arabic</option>
                    <option value="es">Spanish</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Date Format</label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={generalForm.dateFormat} onChange={(e) => setGeneralForm((f) => ({ ...f, dateFormat: e.target.value }))}>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Timezone</label>
                  <Input placeholder="e.g. UTC, Asia/Karachi" value={generalForm.timezone} onChange={(e) => setGeneralForm((f) => ({ ...f, timezone: e.target.value }))} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Currency is managed in <button type="button" className="text-primary underline underline-offset-2" onClick={() => setActiveTab('company')}>Company Profile</button> — it applies to every screen in the ERP.
                  </label>
                </div>
              </div>
              <Separator />
              <p className="text-sm font-medium">UI Preferences</p>
              <div className="space-y-2 max-w-2xl">
                {[
                  { key: 'compactTables' as const, label: 'Compact Tables' },
                  { key: 'stickySidebar' as const, label: 'Sticky Sidebar' },
                  { key: 'animationsEnabled' as const, label: 'Animations' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={generalForm[key]} onChange={(e) => setGeneralForm((f) => ({ ...f, [key]: e.target.checked }))} className="h-4 w-4" />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button disabled={generalMutation.isPending} onClick={() => generalMutation.mutate(generalForm)}>
                  <Save className="h-4 w-4 mr-1" />Save Changes
                </Button>
                <Button variant="outline" onClick={() => setGeneralForm(GENERAL_DEFAULTS)}>
                  <RotateCcw className="h-4 w-4 mr-1" />Restore Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

          </div>
        </div>
      </Tabs>

      {/* Sticky unsaved-changes bar */}
      {((activeTab === 'general' && isGeneralDirty) || (activeTab === 'security' && isSecurityDirty)) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur px-4 py-3 shadow-lg sm:left-64">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">1 unsaved change</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (activeTab === 'general') setGeneralForm(generalBaseline)
                  if (activeTab === 'security' && securityPolicy) {
                    setSecurityForm({
                      maxLoginAttempts: securityPolicy.maxLoginAttempts, lockoutDurationMins: securityPolicy.lockoutDurationMins,
                      sessionTimeoutMins: securityPolicy.sessionTimeoutMins, passwordMinLength: securityPolicy.passwordMinLength,
                      passwordRequireUpper: securityPolicy.passwordRequireUpper, passwordRequireNumber: securityPolicy.passwordRequireNumber,
                      passwordRequireSpecial: securityPolicy.passwordRequireSpecial, mfaRequired: securityPolicy.mfaRequired,
                    })
                  }
                }}
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={() => activeTab === 'general' ? generalMutation.mutate(generalForm) : securityMutation.mutate(securityForm)}
              >
                <Save className="h-3.5 w-3.5 mr-1" />Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
