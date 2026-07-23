import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import type { Role } from '@prisma/client'
import { getAppCurrencyCode, getAppCurrencyLocale } from './currency-store'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// currency defaults to the ERP's configured currency (Settings → Company Profile)
// when the caller doesn't pass one explicitly (e.g. a bank account in its own currency).
export function formatCurrency(amount: number | string, currency?: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat(getAppCurrencyLocale(), { style: 'currency', currency: currency ?? getAppCurrencyCode() }).format(num)
}

export function formatDate(date: Date | string | null | undefined, fmt = 'MMM dd, yyyy'): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt)
}

export function formatNumber(num: number | string, decimals = 2): string {
  const n = typeof num === 'string' ? parseFloat(num) : num
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// Appends the packing/weight variant so same-named items are distinguishable,
// e.g. itemDisplayName({ name: 'Beans', packing: '2kg' }) → "Beans (2kg)"
export function itemDisplayName(item: { name: string; packing?: string | null }): string {
  return item.packing ? `${item.name} (${item.packing})` : item.name
}

export function generateCode(prefix: string, num: number): string {
  return `${prefix}${String(num).padStart(5, '0')}`
}

export function apiResponse<T>(data: T, success = true, error?: string) {
  return { success, data, error: error ?? null }
}

export function apiError(error: string) {
  return { success: false, data: null, error }
}

export function apiErrorSafe(err: unknown, fallback = 'An unexpected error occurred') {
  const message = process.env.NODE_ENV === 'development' && err instanceof Error ? err.message : fallback
  return { success: false, data: null, error: message }
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  OPERATOR: 'Operator',
  VIEWER: 'Viewer',
}

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['dashboard', 'hr', 'procurement', 'inventory', 'sales', 'finance', 'projects', 'reports', 'insights', 'settings', 'pos', 'customers', 'suppliers', 'expenses', 'compliance', 'crm', 'workflow', 'documents', 'fulfillment'],
  MANAGER: ['dashboard', 'hr', 'procurement', 'inventory', 'sales', 'finance', 'projects', 'reports', 'insights', 'pos', 'customers', 'suppliers', 'expenses', 'compliance', 'crm', 'workflow', 'documents', 'fulfillment'],
  OPERATOR: ['dashboard', 'hr', 'procurement', 'inventory', 'sales', 'pos', 'customers', 'suppliers', 'expenses', 'crm', 'workflow', 'documents', 'fulfillment'],
  VIEWER: ['dashboard', 'reports', 'workflow'],
}

export function hasPermission(role: Role | null | undefined, module: string): boolean {
  if (!role) return false
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false
  return perms.includes('*') || perms.includes(module)
}

export function paginate<T>(items: T[], page: number, limit: number) {
  const total = items.length
  const pages = Math.ceil(total / limit)
  const data = items.slice((page - 1) * limit, page * limit)
  return { data, total, pages, page, limit }
}
