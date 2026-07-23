/**
 * Seeds all 13 ERP custom roles with their full permission sets and data-visibility scopes.
 * Run: npx tsx prisma/seed-roles.ts
 *
 * Scopes:
 *   organization — sees all records regardless of dept/branch
 *   branch       — sees records belonging to user's branch
 *   department   — sees records belonging to user's department
 *   own          — sees only records created by / assigned to themselves
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Permission catalogue (must match the API seed list) ─────────────────────

const ALL_PERMISSIONS = [
  { module: 'dashboard',     action: 'view' },
  { module: 'crm',           action: 'view' },   { module: 'crm',    action: 'create' },
  { module: 'crm',           action: 'update' },  { module: 'crm',    action: 'delete' },
  { module: 'crm',           action: 'assign' },  { module: 'crm',    action: 'export' },
  { module: 'customers',     action: 'view' },   { module: 'customers', action: 'create' },
  { module: 'customers',     action: 'update' }, { module: 'customers', action: 'delete' },
  { module: 'customers',     action: 'export' },
  { module: 'vendors',       action: 'view' },   { module: 'vendors',  action: 'create' },
  { module: 'vendors',       action: 'update' }, { module: 'vendors',  action: 'delete' },
  { module: 'vendors',       action: 'export' },
  { module: 'sales',         action: 'view' },   { module: 'sales',    action: 'create' },
  { module: 'sales',         action: 'update' }, { module: 'sales',    action: 'delete' },
  { module: 'sales',         action: 'approve' },{ module: 'sales',    action: 'reject' },
  { module: 'sales',         action: 'cancel' }, { module: 'sales',    action: 'print' },
  { module: 'sales',         action: 'export' },
  { module: 'procurement',   action: 'view' },   { module: 'procurement', action: 'create' },
  { module: 'procurement',   action: 'update' }, { module: 'procurement', action: 'delete' },
  { module: 'procurement',   action: 'approve' },{ module: 'procurement', action: 'reject' },
  { module: 'procurement',   action: 'cancel' }, { module: 'procurement', action: 'print' },
  { module: 'procurement',   action: 'export' },
  { module: 'inventory',     action: 'view' },   { module: 'inventory', action: 'create' },
  { module: 'inventory',     action: 'update' }, { module: 'inventory', action: 'delete' },
  { module: 'inventory',     action: 'transfer' },{ module: 'inventory', action: 'adjust' },
  { module: 'inventory',     action: 'export' },
  { module: 'finance',       action: 'view' },   { module: 'finance',  action: 'create' },
  { module: 'finance',       action: 'update' }, { module: 'finance',  action: 'delete' },
  { module: 'finance',       action: 'approve' },{ module: 'finance',  action: 'journal' },
  { module: 'finance',       action: 'export' },
  { module: 'hr',            action: 'view' },   { module: 'hr',       action: 'create' },
  { module: 'hr',            action: 'update' }, { module: 'hr',       action: 'delete' },
  { module: 'hr',            action: 'manage' }, { module: 'hr',       action: 'export' },
  { module: 'payroll',       action: 'view' },   { module: 'payroll',  action: 'create' },
  { module: 'payroll',       action: 'approve' },{ module: 'payroll',  action: 'export' },
  { module: 'pos',           action: 'view' },   { module: 'pos',      action: 'create' },
  { module: 'documents',     action: 'view' },   { module: 'documents', action: 'create' },
  { module: 'documents',     action: 'delete' }, { module: 'documents', action: 'archive' },
  { module: 'tasks',         action: 'view' },   { module: 'tasks',    action: 'create' },
  { module: 'tasks',         action: 'update' }, { module: 'tasks',    action: 'assign' },
  { module: 'tasks',         action: 'close' },
  { module: 'reports',       action: 'view' },   { module: 'reports',  action: 'export' },
  { module: 'reports',       action: 'configure' },
  { module: 'insights',      action: 'view' },   { module: 'insights', action: 'export' },
  { module: 'notifications', action: 'view' },   { module: 'notifications', action: 'configure' },
  { module: 'workflow',      action: 'view' },   { module: 'workflow', action: 'approve' },
  { module: 'workflow',      action: 'reject' },  { module: 'workflow', action: 'manage' },
  { module: 'workflow',      action: 'configure' },
  { module: 'audit',         action: 'view' },   { module: 'audit',    action: 'export' },
  { module: 'users',         action: 'view' },   { module: 'users',    action: 'create' },
  { module: 'users',         action: 'update' }, { module: 'users',    action: 'delete' },
  { module: 'users',         action: 'suspend' },{ module: 'users',    action: 'configure' },
  { module: 'roles',         action: 'view' },   { module: 'roles',    action: 'create' },
  { module: 'roles',         action: 'update' }, { module: 'roles',    action: 'delete' },
  { module: 'roles',         action: 'configure' },
  { module: 'permissions',   action: 'view' },   { module: 'permissions', action: 'configure' },
  { module: 'settings',      action: 'view' },   { module: 'settings', action: 'manage' },
  { module: 'settings',      action: 'configure' },
  { module: 'fulfillment',   action: 'view' },   { module: 'fulfillment', action: 'create' },
  { module: 'fulfillment',   action: 'update' }, { module: 'fulfillment', action: 'delete' },
  { module: 'fulfillment',   action: 'approve' },{ module: 'fulfillment', action: 'manage' },
]

type PermRef = { module: string; action: string; scope?: string }

// ─── Role definitions ─────────────────────────────────────────────────────────

const ROLES: Array<{
  name: string
  description: string
  permissions: PermRef[]
}> = [
  // ── 1. Super Admin ──────────────────────────────────────────────────────────
  {
    name: 'Super Admin',
    description: 'Unrestricted access to all modules and system configuration.',
    permissions: ALL_PERMISSIONS.map((p) => ({ ...p, scope: 'organization' })),
  },

  // ── 2. Company Admin ────────────────────────────────────────────────────────
  {
    name: 'Company Admin',
    description: 'Full operational control of the company — all modules, all data.',
    permissions: ALL_PERMISSIONS.map((p) => ({ ...p, scope: 'organization' })),
  },

  // ── 3. CEO / Director ───────────────────────────────────────────────────────
  {
    name: 'CEO / Director',
    description: 'Executive oversight — approve/reject across all modules, full reporting.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'organization' },
      // CRM
      { module: 'crm', action: 'view', scope: 'organization' },
      { module: 'crm', action: 'assign', scope: 'organization' },
      { module: 'crm', action: 'export', scope: 'organization' },
      // Customers / Vendors
      { module: 'customers', action: 'view', scope: 'organization' },
      { module: 'customers', action: 'export', scope: 'organization' },
      { module: 'vendors', action: 'view', scope: 'organization' },
      { module: 'vendors', action: 'export', scope: 'organization' },
      // Sales
      { module: 'sales', action: 'view', scope: 'organization' },
      { module: 'sales', action: 'approve', scope: 'organization' },
      { module: 'sales', action: 'reject', scope: 'organization' },
      { module: 'sales', action: 'cancel', scope: 'organization' },
      { module: 'sales', action: 'print', scope: 'organization' },
      { module: 'sales', action: 'export', scope: 'organization' },
      // Procurement
      { module: 'procurement', action: 'view', scope: 'organization' },
      { module: 'procurement', action: 'approve', scope: 'organization' },
      { module: 'procurement', action: 'reject', scope: 'organization' },
      { module: 'procurement', action: 'cancel', scope: 'organization' },
      { module: 'procurement', action: 'print', scope: 'organization' },
      { module: 'procurement', action: 'export', scope: 'organization' },
      // Inventory
      { module: 'inventory', action: 'view', scope: 'organization' },
      { module: 'inventory', action: 'export', scope: 'organization' },
      // Finance
      { module: 'finance', action: 'view', scope: 'organization' },
      { module: 'finance', action: 'approve', scope: 'organization' },
      { module: 'finance', action: 'export', scope: 'organization' },
      // HR & Payroll
      { module: 'hr', action: 'view', scope: 'organization' },
      { module: 'hr', action: 'manage', scope: 'organization' },
      { module: 'hr', action: 'export', scope: 'organization' },
      { module: 'payroll', action: 'view', scope: 'organization' },
      { module: 'payroll', action: 'approve', scope: 'organization' },
      { module: 'payroll', action: 'export', scope: 'organization' },
      // Operational
      { module: 'pos', action: 'view', scope: 'organization' },
      { module: 'documents', action: 'view', scope: 'organization' },
      { module: 'tasks', action: 'view', scope: 'organization' },
      { module: 'tasks', action: 'assign', scope: 'organization' },
      { module: 'tasks', action: 'close', scope: 'organization' },
      // Reports & Analytics
      { module: 'reports', action: 'view', scope: 'organization' },
      { module: 'reports', action: 'export', scope: 'organization' },
      { module: 'reports', action: 'configure', scope: 'organization' },
      { module: 'insights', action: 'view', scope: 'organization' },
      { module: 'insights', action: 'export', scope: 'organization' },
      // Admin
      { module: 'notifications', action: 'view', scope: 'organization' },
      { module: 'workflow', action: 'view', scope: 'organization' },
      { module: 'workflow', action: 'approve', scope: 'organization' },
      { module: 'workflow', action: 'reject', scope: 'organization' },
      { module: 'audit', action: 'view', scope: 'organization' },
      { module: 'audit', action: 'export', scope: 'organization' },
      { module: 'users', action: 'view', scope: 'organization' },
      { module: 'roles', action: 'view', scope: 'organization' },
      { module: 'permissions', action: 'view', scope: 'organization' },
      { module: 'settings', action: 'view', scope: 'organization' },
    ],
  },

  // ── 4. Operations Manager ───────────────────────────────────────────────────
  {
    name: 'Operations Manager',
    description: 'Cross-functional: approve sales, procurement, and inventory at organisation level.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'organization' },
      { module: 'crm', action: 'view', scope: 'organization' },
      { module: 'customers', action: 'view', scope: 'organization' },
      { module: 'vendors', action: 'view', scope: 'organization' },
      // Sales — full except delete
      { module: 'sales', action: 'view', scope: 'organization' },
      { module: 'sales', action: 'create', scope: 'organization' },
      { module: 'sales', action: 'update', scope: 'organization' },
      { module: 'sales', action: 'approve', scope: 'organization' },
      { module: 'sales', action: 'reject', scope: 'organization' },
      { module: 'sales', action: 'cancel', scope: 'organization' },
      { module: 'sales', action: 'print', scope: 'organization' },
      { module: 'sales', action: 'export', scope: 'organization' },
      // Procurement — full except delete
      { module: 'procurement', action: 'view', scope: 'organization' },
      { module: 'procurement', action: 'create', scope: 'organization' },
      { module: 'procurement', action: 'update', scope: 'organization' },
      { module: 'procurement', action: 'approve', scope: 'organization' },
      { module: 'procurement', action: 'reject', scope: 'organization' },
      { module: 'procurement', action: 'cancel', scope: 'organization' },
      { module: 'procurement', action: 'print', scope: 'organization' },
      { module: 'procurement', action: 'export', scope: 'organization' },
      // Inventory — full
      { module: 'inventory', action: 'view', scope: 'organization' },
      { module: 'inventory', action: 'create', scope: 'organization' },
      { module: 'inventory', action: 'update', scope: 'organization' },
      { module: 'inventory', action: 'transfer', scope: 'organization' },
      { module: 'inventory', action: 'adjust', scope: 'organization' },
      { module: 'inventory', action: 'export', scope: 'organization' },
      // Support
      { module: 'finance', action: 'view', scope: 'organization' },
      { module: 'hr', action: 'view', scope: 'organization' },
      { module: 'pos', action: 'view', scope: 'organization' },
      { module: 'documents', action: 'view', scope: 'organization' },
      { module: 'documents', action: 'create', scope: 'organization' },
      { module: 'tasks', action: 'view', scope: 'organization' },
      { module: 'tasks', action: 'create', scope: 'organization' },
      { module: 'tasks', action: 'update', scope: 'organization' },
      { module: 'tasks', action: 'assign', scope: 'organization' },
      { module: 'tasks', action: 'close', scope: 'organization' },
      { module: 'reports', action: 'view', scope: 'organization' },
      { module: 'reports', action: 'export', scope: 'organization' },
      { module: 'insights', action: 'view', scope: 'organization' },
      { module: 'notifications', action: 'view', scope: 'organization' },
      { module: 'workflow', action: 'view', scope: 'organization' },
      { module: 'workflow', action: 'approve', scope: 'organization' },
      { module: 'workflow', action: 'reject', scope: 'organization' },
      { module: 'audit', action: 'view', scope: 'organization' },
    ],
  },

  // ── 5. Sales Manager ────────────────────────────────────────────────────────
  {
    name: 'Sales Manager',
    description: 'Manages entire sales team and CRM pipeline. Approves sales orders department-wide.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'department' },
      // CRM — full
      { module: 'crm', action: 'view', scope: 'department' },
      { module: 'crm', action: 'create', scope: 'department' },
      { module: 'crm', action: 'update', scope: 'department' },
      { module: 'crm', action: 'delete', scope: 'department' },
      { module: 'crm', action: 'assign', scope: 'department' },
      { module: 'crm', action: 'export', scope: 'department' },
      // Customers — full
      { module: 'customers', action: 'view', scope: 'department' },
      { module: 'customers', action: 'create', scope: 'department' },
      { module: 'customers', action: 'update', scope: 'department' },
      { module: 'customers', action: 'delete', scope: 'department' },
      { module: 'customers', action: 'export', scope: 'department' },
      // Sales — full
      { module: 'sales', action: 'view', scope: 'department' },
      { module: 'sales', action: 'create', scope: 'department' },
      { module: 'sales', action: 'update', scope: 'department' },
      { module: 'sales', action: 'delete', scope: 'department' },
      { module: 'sales', action: 'approve', scope: 'department' },
      { module: 'sales', action: 'reject', scope: 'department' },
      { module: 'sales', action: 'cancel', scope: 'department' },
      { module: 'sales', action: 'print', scope: 'department' },
      { module: 'sales', action: 'export', scope: 'department' },
      // Support
      { module: 'inventory', action: 'view', scope: 'organization' },
      { module: 'finance', action: 'view', scope: 'department' },
      { module: 'vendors', action: 'view', scope: 'organization' },
      { module: 'documents', action: 'view', scope: 'department' },
      { module: 'documents', action: 'create', scope: 'department' },
      { module: 'tasks', action: 'view', scope: 'department' },
      { module: 'tasks', action: 'create', scope: 'department' },
      { module: 'tasks', action: 'update', scope: 'department' },
      { module: 'tasks', action: 'assign', scope: 'department' },
      { module: 'tasks', action: 'close', scope: 'department' },
      { module: 'reports', action: 'view', scope: 'department' },
      { module: 'reports', action: 'export', scope: 'department' },
      { module: 'notifications', action: 'view', scope: 'department' },
      { module: 'workflow', action: 'view', scope: 'department' },
      { module: 'workflow', action: 'approve', scope: 'department' },
      { module: 'workflow', action: 'reject', scope: 'department' },
    ],
  },

  // ── 6. Sales Executive ──────────────────────────────────────────────────────
  {
    name: 'Sales Executive',
    description: 'Creates and manages own leads, opportunities, and sales orders.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'own' },
      { module: 'crm', action: 'view', scope: 'own' },
      { module: 'crm', action: 'create', scope: 'own' },
      { module: 'crm', action: 'update', scope: 'own' },
      { module: 'crm', action: 'assign', scope: 'own' },
      { module: 'customers', action: 'view', scope: 'own' },
      { module: 'customers', action: 'create', scope: 'own' },
      { module: 'customers', action: 'update', scope: 'own' },
      { module: 'sales', action: 'view', scope: 'own' },
      { module: 'sales', action: 'create', scope: 'own' },
      { module: 'sales', action: 'update', scope: 'own' },
      { module: 'sales', action: 'print', scope: 'own' },
      { module: 'inventory', action: 'view', scope: 'organization' },
      { module: 'documents', action: 'view', scope: 'own' },
      { module: 'documents', action: 'create', scope: 'own' },
      { module: 'tasks', action: 'view', scope: 'own' },
      { module: 'tasks', action: 'create', scope: 'own' },
      { module: 'tasks', action: 'update', scope: 'own' },
      { module: 'notifications', action: 'view', scope: 'own' },
      { module: 'workflow', action: 'view', scope: 'own' },
    ],
  },

  // ── 7. Procurement Manager ──────────────────────────────────────────────────
  {
    name: 'Procurement Manager',
    description: 'Manages all procurement activity. Approves purchase orders department-wide.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'department' },
      // Vendors — full
      { module: 'vendors', action: 'view', scope: 'organization' },
      { module: 'vendors', action: 'create', scope: 'organization' },
      { module: 'vendors', action: 'update', scope: 'organization' },
      { module: 'vendors', action: 'delete', scope: 'organization' },
      { module: 'vendors', action: 'export', scope: 'organization' },
      // Procurement — full
      { module: 'procurement', action: 'view', scope: 'department' },
      { module: 'procurement', action: 'create', scope: 'department' },
      { module: 'procurement', action: 'update', scope: 'department' },
      { module: 'procurement', action: 'delete', scope: 'department' },
      { module: 'procurement', action: 'approve', scope: 'department' },
      { module: 'procurement', action: 'reject', scope: 'department' },
      { module: 'procurement', action: 'cancel', scope: 'department' },
      { module: 'procurement', action: 'print', scope: 'department' },
      { module: 'procurement', action: 'export', scope: 'department' },
      // Support
      { module: 'inventory', action: 'view', scope: 'organization' },
      { module: 'inventory', action: 'export', scope: 'organization' },
      { module: 'finance', action: 'view', scope: 'organization' },
      { module: 'documents', action: 'view', scope: 'department' },
      { module: 'documents', action: 'create', scope: 'department' },
      { module: 'tasks', action: 'view', scope: 'department' },
      { module: 'tasks', action: 'create', scope: 'department' },
      { module: 'tasks', action: 'update', scope: 'department' },
      { module: 'tasks', action: 'assign', scope: 'department' },
      { module: 'tasks', action: 'close', scope: 'department' },
      { module: 'reports', action: 'view', scope: 'department' },
      { module: 'reports', action: 'export', scope: 'department' },
      { module: 'notifications', action: 'view', scope: 'department' },
      { module: 'workflow', action: 'view', scope: 'department' },
      { module: 'workflow', action: 'approve', scope: 'department' },
      { module: 'workflow', action: 'reject', scope: 'department' },
    ],
  },

  // ── 8. Procurement Officer ──────────────────────────────────────────────────
  {
    name: 'Procurement Officer',
    description: 'Creates purchase requests and orders. Cannot approve — escalates to manager.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'own' },
      { module: 'vendors', action: 'view', scope: 'organization' },
      { module: 'vendors', action: 'create', scope: 'own' },
      { module: 'vendors', action: 'update', scope: 'own' },
      { module: 'procurement', action: 'view', scope: 'own' },
      { module: 'procurement', action: 'create', scope: 'own' },
      { module: 'procurement', action: 'update', scope: 'own' },
      { module: 'procurement', action: 'print', scope: 'own' },
      { module: 'inventory', action: 'view', scope: 'organization' },
      { module: 'documents', action: 'view', scope: 'own' },
      { module: 'documents', action: 'create', scope: 'own' },
      { module: 'tasks', action: 'view', scope: 'own' },
      { module: 'tasks', action: 'create', scope: 'own' },
      { module: 'tasks', action: 'update', scope: 'own' },
      { module: 'notifications', action: 'view', scope: 'own' },
      { module: 'workflow', action: 'view', scope: 'own' },
    ],
  },

  // ── 9. Finance Manager ──────────────────────────────────────────────────────
  {
    name: 'Finance Manager',
    description: 'Full control of all financial operations. Approves journals, payroll, and payments.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'organization' },
      // Finance — full
      { module: 'finance', action: 'view', scope: 'organization' },
      { module: 'finance', action: 'create', scope: 'organization' },
      { module: 'finance', action: 'update', scope: 'organization' },
      { module: 'finance', action: 'delete', scope: 'organization' },
      { module: 'finance', action: 'approve', scope: 'organization' },
      { module: 'finance', action: 'journal', scope: 'organization' },
      { module: 'finance', action: 'export', scope: 'organization' },
      // Payroll — approve + export
      { module: 'payroll', action: 'view', scope: 'organization' },
      { module: 'payroll', action: 'approve', scope: 'organization' },
      { module: 'payroll', action: 'export', scope: 'organization' },
      // Cross-module read access for reconciliation
      { module: 'customers', action: 'view', scope: 'organization' },
      { module: 'customers', action: 'export', scope: 'organization' },
      { module: 'vendors', action: 'view', scope: 'organization' },
      { module: 'vendors', action: 'export', scope: 'organization' },
      { module: 'sales', action: 'view', scope: 'organization' },
      { module: 'sales', action: 'export', scope: 'organization' },
      { module: 'procurement', action: 'view', scope: 'organization' },
      { module: 'procurement', action: 'export', scope: 'organization' },
      { module: 'hr', action: 'view', scope: 'organization' },
      // Docs, tasks, reports
      { module: 'documents', action: 'view', scope: 'organization' },
      { module: 'documents', action: 'create', scope: 'organization' },
      { module: 'documents', action: 'archive', scope: 'organization' },
      { module: 'reports', action: 'view', scope: 'organization' },
      { module: 'reports', action: 'export', scope: 'organization' },
      { module: 'reports', action: 'configure', scope: 'organization' },
      { module: 'insights', action: 'view', scope: 'organization' },
      { module: 'insights', action: 'export', scope: 'organization' },
      { module: 'notifications', action: 'view', scope: 'organization' },
      { module: 'workflow', action: 'view', scope: 'organization' },
      { module: 'workflow', action: 'approve', scope: 'organization' },
      { module: 'workflow', action: 'reject', scope: 'organization' },
      { module: 'audit', action: 'view', scope: 'organization' },
      { module: 'audit', action: 'export', scope: 'organization' },
    ],
  },

  // ── 10. Accountant ──────────────────────────────────────────────────────────
  {
    name: 'Accountant',
    description: 'Posts journals and manages day-to-day bookkeeping. Cannot approve transactions.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'department' },
      { module: 'finance', action: 'view', scope: 'department' },
      { module: 'finance', action: 'create', scope: 'department' },
      { module: 'finance', action: 'update', scope: 'department' },
      { module: 'finance', action: 'journal', scope: 'department' },
      { module: 'finance', action: 'export', scope: 'department' },
      { module: 'payroll', action: 'view', scope: 'department' },
      { module: 'customers', action: 'view', scope: 'organization' },
      { module: 'vendors', action: 'view', scope: 'organization' },
      { module: 'sales', action: 'view', scope: 'organization' },
      { module: 'procurement', action: 'view', scope: 'organization' },
      { module: 'documents', action: 'view', scope: 'department' },
      { module: 'documents', action: 'create', scope: 'department' },
      { module: 'reports', action: 'view', scope: 'department' },
      { module: 'reports', action: 'export', scope: 'department' },
      { module: 'notifications', action: 'view', scope: 'own' },
      { module: 'workflow', action: 'view', scope: 'own' },
    ],
  },

  // ── 11. HR Manager ──────────────────────────────────────────────────────────
  {
    name: 'HR Manager',
    description: 'Full HR authority: hire, manage, leave approval, payroll sign-off.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'organization' },
      // HR — full
      { module: 'hr', action: 'view', scope: 'organization' },
      { module: 'hr', action: 'create', scope: 'organization' },
      { module: 'hr', action: 'update', scope: 'organization' },
      { module: 'hr', action: 'delete', scope: 'organization' },
      { module: 'hr', action: 'manage', scope: 'organization' },
      { module: 'hr', action: 'export', scope: 'organization' },
      // Payroll — full
      { module: 'payroll', action: 'view', scope: 'organization' },
      { module: 'payroll', action: 'create', scope: 'organization' },
      { module: 'payroll', action: 'approve', scope: 'organization' },
      { module: 'payroll', action: 'export', scope: 'organization' },
      // Documents — full
      { module: 'documents', action: 'view', scope: 'organization' },
      { module: 'documents', action: 'create', scope: 'organization' },
      { module: 'documents', action: 'delete', scope: 'organization' },
      { module: 'documents', action: 'archive', scope: 'organization' },
      // Tasks & reports
      { module: 'tasks', action: 'view', scope: 'organization' },
      { module: 'tasks', action: 'create', scope: 'organization' },
      { module: 'tasks', action: 'update', scope: 'organization' },
      { module: 'tasks', action: 'assign', scope: 'organization' },
      { module: 'tasks', action: 'close', scope: 'organization' },
      { module: 'reports', action: 'view', scope: 'organization' },
      { module: 'reports', action: 'export', scope: 'organization' },
      { module: 'notifications', action: 'view', scope: 'organization' },
      { module: 'notifications', action: 'configure', scope: 'organization' },
      { module: 'workflow', action: 'view', scope: 'organization' },
      { module: 'workflow', action: 'approve', scope: 'organization' },
      { module: 'workflow', action: 'reject', scope: 'organization' },
    ],
  },

  // ── 12. HR Executive ────────────────────────────────────────────────────────
  {
    name: 'HR Executive',
    description: 'Handles day-to-day HR operations. Escalates approvals to HR Manager.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'department' },
      { module: 'hr', action: 'view', scope: 'department' },
      { module: 'hr', action: 'create', scope: 'department' },
      { module: 'hr', action: 'update', scope: 'department' },
      { module: 'hr', action: 'export', scope: 'department' },
      { module: 'payroll', action: 'view', scope: 'department' },
      { module: 'documents', action: 'view', scope: 'department' },
      { module: 'documents', action: 'create', scope: 'department' },
      { module: 'tasks', action: 'view', scope: 'department' },
      { module: 'tasks', action: 'create', scope: 'department' },
      { module: 'tasks', action: 'update', scope: 'department' },
      { module: 'notifications', action: 'view', scope: 'own' },
      { module: 'workflow', action: 'view', scope: 'own' },
    ],
  },

  // ── 13. Payroll Officer ─────────────────────────────────────────────────────
  {
    name: 'Payroll Officer',
    description: 'Processes payroll runs and submits for approval. Read-only on HR records.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'organization' },
      { module: 'hr', action: 'view', scope: 'organization' },
      { module: 'hr', action: 'export', scope: 'organization' },
      { module: 'payroll', action: 'view', scope: 'organization' },
      { module: 'payroll', action: 'create', scope: 'organization' },
      { module: 'payroll', action: 'approve', scope: 'organization' },
      { module: 'payroll', action: 'export', scope: 'organization' },
      { module: 'documents', action: 'view', scope: 'organization' },
      { module: 'reports', action: 'view', scope: 'organization' },
      { module: 'reports', action: 'export', scope: 'organization' },
      { module: 'notifications', action: 'view', scope: 'own' },
    ],
  },

  // ── 14. Inventory Manager ───────────────────────────────────────────────────
  {
    name: 'Inventory Manager',
    description: 'Full control of stock, transfers, and adjustments within their branch/warehouse.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'branch' },
      // Inventory — full
      { module: 'inventory', action: 'view', scope: 'branch' },
      { module: 'inventory', action: 'create', scope: 'branch' },
      { module: 'inventory', action: 'update', scope: 'branch' },
      { module: 'inventory', action: 'delete', scope: 'branch' },
      { module: 'inventory', action: 'transfer', scope: 'branch' },
      { module: 'inventory', action: 'adjust', scope: 'branch' },
      { module: 'inventory', action: 'export', scope: 'branch' },
      // Cross-module reads
      { module: 'procurement', action: 'view', scope: 'branch' },
      { module: 'sales', action: 'view', scope: 'branch' },
      { module: 'documents', action: 'view', scope: 'branch' },
      { module: 'documents', action: 'create', scope: 'branch' },
      { module: 'tasks', action: 'view', scope: 'branch' },
      { module: 'tasks', action: 'create', scope: 'branch' },
      { module: 'tasks', action: 'update', scope: 'branch' },
      { module: 'tasks', action: 'assign', scope: 'branch' },
      { module: 'tasks', action: 'close', scope: 'branch' },
      { module: 'reports', action: 'view', scope: 'branch' },
      { module: 'reports', action: 'export', scope: 'branch' },
      { module: 'notifications', action: 'view', scope: 'own' },
      { module: 'workflow', action: 'view', scope: 'own' },
    ],
  },

  // ── 15. Warehouse Staff ─────────────────────────────────────────────────────
  {
    name: 'Warehouse Staff',
    description: 'Receives goods and performs stock transfers. No approvals or deletions.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'branch' },
      { module: 'inventory', action: 'view', scope: 'branch' },
      { module: 'inventory', action: 'transfer', scope: 'branch' },
      { module: 'procurement', action: 'view', scope: 'branch' },
      { module: 'notifications', action: 'view', scope: 'own' },
    ],
  },

  // ── 16. Auditor ─────────────────────────────────────────────────────────────
  {
    name: 'Auditor',
    description: 'Read-only across all modules. Can view and export audit logs. Cannot create or modify anything.',
    permissions: [
      { module: 'dashboard', action: 'view', scope: 'organization' },
      { module: 'crm', action: 'view', scope: 'organization' },
      { module: 'customers', action: 'view', scope: 'organization' },
      { module: 'customers', action: 'export', scope: 'organization' },
      { module: 'vendors', action: 'view', scope: 'organization' },
      { module: 'vendors', action: 'export', scope: 'organization' },
      { module: 'sales', action: 'view', scope: 'organization' },
      { module: 'sales', action: 'print', scope: 'organization' },
      { module: 'sales', action: 'export', scope: 'organization' },
      { module: 'procurement', action: 'view', scope: 'organization' },
      { module: 'procurement', action: 'print', scope: 'organization' },
      { module: 'procurement', action: 'export', scope: 'organization' },
      { module: 'inventory', action: 'view', scope: 'organization' },
      { module: 'inventory', action: 'export', scope: 'organization' },
      { module: 'finance', action: 'view', scope: 'organization' },
      { module: 'finance', action: 'export', scope: 'organization' },
      { module: 'hr', action: 'view', scope: 'organization' },
      { module: 'hr', action: 'export', scope: 'organization' },
      { module: 'payroll', action: 'view', scope: 'organization' },
      { module: 'payroll', action: 'export', scope: 'organization' },
      { module: 'pos', action: 'view', scope: 'organization' },
      { module: 'documents', action: 'view', scope: 'organization' },
      { module: 'reports', action: 'view', scope: 'organization' },
      { module: 'reports', action: 'export', scope: 'organization' },
      { module: 'reports', action: 'configure', scope: 'organization' },
      { module: 'insights', action: 'view', scope: 'organization' },
      { module: 'insights', action: 'export', scope: 'organization' },
      { module: 'workflow', action: 'view', scope: 'organization' },
      { module: 'audit', action: 'view', scope: 'organization' },
      { module: 'audit', action: 'export', scope: 'organization' },
      { module: 'users', action: 'view', scope: 'organization' },
      { module: 'roles', action: 'view', scope: 'organization' },
      { module: 'permissions', action: 'view', scope: 'organization' },
      { module: 'notifications', action: 'view', scope: 'own' },
    ],
  },
]

// ─── Seed logic ──────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding permissions...')

  // 1. Upsert all permissions
  await prisma.permission.createMany({
    data: ALL_PERMISSIONS,
    skipDuplicates: true,
  })

  // Load the permission ID map: "module:action" → id
  const permissions = await prisma.permission.findMany()
  const permMap = new Map<string, string>()
  for (const p of permissions) {
    permMap.set(`${p.module}:${p.action}`, p.id)
  }

  console.log(`Loaded ${permMap.size} permissions.`)
  console.log('Seeding roles...')

  let created = 0
  let updated = 0

  for (const roleDef of ROLES) {
    // Upsert role by name (findFirst + create/update)
    let role = await prisma.customRole.findFirst({ where: { name: roleDef.name } })

    if (!role) {
      role = await prisma.customRole.create({
        data: { name: roleDef.name, description: roleDef.description, isActive: true },
      })
      created++
    } else {
      await prisma.customRole.update({
        where: { id: role.id },
        data: { description: roleDef.description, isActive: true },
      })
      updated++
    }

    // Delete existing role permissions and re-create (ensures clean state on re-run)
    await prisma.rolePermission.deleteMany({ where: { customRoleId: role.id } })

    const rpData: { customRoleId: string; permissionId: string; scope: string | null }[] = []
    const seen = new Set<string>()

    for (const perm of roleDef.permissions) {
      const permId = permMap.get(`${perm.module}:${perm.action}`)
      if (!permId) {
        console.warn(`  ⚠ Unknown permission: ${perm.module}:${perm.action} — skipping`)
        continue
      }
      if (seen.has(permId)) continue
      seen.add(permId)
      rpData.push({ customRoleId: role.id, permissionId: permId, scope: perm.scope ?? null })
    }

    await prisma.rolePermission.createMany({ data: rpData })

    const scopeSummary = Array.from(new Set(roleDef.permissions.map((p) => p.scope))).filter(Boolean)
    console.log(`  ✓ ${roleDef.name} — ${rpData.length} permissions [${scopeSummary.join(', ')}]`)
  }

  console.log(`\nDone: ${created} roles created, ${updated} roles updated.`)
  console.log(`Total roles in DB: ${await prisma.customRole.count()}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
