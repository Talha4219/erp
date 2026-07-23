'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn, ROLE_LABELS, hasPermission } from '@/lib/utils'
import {
  LayoutDashboard, Users, Users2, ShoppingCart, Package, TrendingUp,
  DollarSign, FolderOpen, BarChart2, Settings, ChevronLeft,
  ChevronRight, Building2, LogOut, Monitor, Truck, Receipt, UserCheck,
  Warehouse, ArrowLeftRight, ClipboardList, TrendingDown, QrCode, ChevronDown,
  FileText, Banknote, Clock, GitBranch,
  Layers,
  FileSearch, Star, RotateCcw, CreditCard,
  Fingerprint, CheckSquare, Workflow, Briefcase, Landmark, FileArchive,
  RefreshCw, Shield, Sparkles, Pin, History, Plus, X, HelpCircle,
  User,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useAppStore } from '@/lib/stores/app-store'
import { useCompanyBranding } from '@/components/providers/CompanySettingsProvider'

type NavChild = { href: string; label: string; icon: React.ElementType }
type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  module?: string
  children?: NavChild[]
}
type NavGroup = { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
      { href: '/pos', label: 'Point of Sale', icon: Monitor, module: 'pos' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { href: '/crm', label: 'CRM', icon: UserCheck, module: 'crm' },
      { href: '/customers', label: 'Customers', icon: Users, module: 'customers' },
      { href: '/business-partners', label: 'Business Partners', icon: Users2, module: 'customers' },
      { href: '/sales', label: 'Sales', icon: TrendingUp, module: 'sales' },
    ],
  },
  {
    label: 'Supply Chain',
    items: [
      {
        href: '/procurement',
        label: 'Purchasing',
        icon: ShoppingCart,
        module: 'procurement',
        children: [
          { href: '/procurement', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/procurement/purchase-requests', label: 'Purchase Requests', icon: ClipboardList },
          { href: '/procurement/approval-center', label: 'Approval Center', icon: CheckSquare },
          { href: '/procurement/rfqs', label: 'RFQs', icon: FileSearch },
          { href: '/procurement/supplier-quotations', label: 'Quotations', icon: FileText },
          { href: '/procurement/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
          { href: '/procurement/goods-receipt', label: 'Goods Receipt', icon: Package },
          { href: '/procurement/purchase-invoices', label: 'Invoices', icon: Receipt },
          { href: '/procurement/vendor-payments', label: 'Payments', icon: CreditCard },
          { href: '/procurement/returns', label: 'Returns', icon: RotateCcw },
          { href: '/procurement/vendors', label: 'Suppliers', icon: Truck },
          { href: '/procurement/supplier-contacts', label: 'Contacts', icon: Users },
          { href: '/procurement/supplier-ratings', label: 'Ratings', icon: Star },
          { href: '/procurement/reports', label: 'Reports', icon: BarChart2 },
        ],
      },
      {
        href: '/inventory',
        label: 'Inventory',
        icon: Package,
        module: 'inventory',
        children: [
          { href: '/inventory/items', label: 'Items', icon: Package },
          { href: '/inventory/warehouses', label: 'Warehouses', icon: Warehouse },
          { href: '/inventory/stock-ledger', label: 'Stock Ledger', icon: TrendingDown },
          { href: '/inventory/batches', label: 'Batch Tracking', icon: ClipboardList },
          { href: '/inventory/transfers', label: 'Transfers', icon: ArrowLeftRight },
          { href: '/inventory/cycle-counts', label: 'Cycle Counts', icon: ClipboardList },
          { href: '/inventory/valuation', label: 'Valuation', icon: TrendingUp },
          { href: '/inventory/serial-numbers', label: 'Serial Numbers', icon: QrCode },
          { href: '/inventory/uom', label: 'Units of Measure', icon: Layers },
          { href: '/inventory/variants', label: 'Item Variants', icon: GitBranch },
        ],
      },
      {
        href: '/fulfillment',
        label: 'Fulfillment',
        icon: Truck,
        module: 'fulfillment',
        children: [
          { href: '/fulfillment', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/fulfillment/orders', label: 'Fulfillment Orders', icon: ClipboardList },
          { href: '/fulfillment/deliveries', label: 'Deliveries', icon: Truck },
          { href: '/fulfillment/pickups', label: 'Pickups', icon: UserCheck },
          { href: '/fulfillment/courier', label: 'Courier', icon: Package },
          { href: '/fulfillment/vehicles', label: 'Vehicles', icon: Truck },
          { href: '/fulfillment/drivers', label: 'Drivers', icon: User },
          { href: '/fulfillment/returns', label: 'Returns', icon: RotateCcw },
          { href: '/fulfillment/settings', label: 'Settings', icon: Settings },
        ],
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        href: '/finance',
        label: 'Finance',
        icon: DollarSign,
        module: 'finance',
        children: [
          { href: '/finance', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/finance/bank-accounts', label: 'Bank Accounts', icon: Landmark },
          { href: '/finance/journal', label: 'Journal Entries', icon: FileText },
          { href: '/finance/reports/pnl', label: 'P&L Statement', icon: TrendingUp },
          { href: '/finance/reports/ar-aging', label: 'AR Ageing', icon: BarChart2 },
          { href: '/finance/reports/ap-aging', label: 'AP Ageing', icon: BarChart2 },
          { href: '/finance/bank-reconciliation', label: 'Bank Reconciliation', icon: RefreshCw },
        ],
      },
      { href: '/expenses', label: 'Expenses', icon: Receipt, module: 'expenses' },
    ],
  },
  {
    label: 'People',
    items: [
      {
        href: '/hr',
        label: 'Human Resources',
        icon: Users,
        module: 'hr',
        children: [
          { href: '/hr/employees', label: 'Employees', icon: Users },
          { href: '/hr/attendance', label: 'Attendance', icon: Clock },
          { href: '/hr/attendance/biometric', label: 'Biometric', icon: Fingerprint },
          { href: '/hr/payroll', label: 'Payroll', icon: Banknote },
          { href: '/hr/payroll/components', label: 'Salary Components', icon: FileText },
          { href: '/hr/recruitment', label: 'Recruitment', icon: Briefcase },
        ],
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/insights', label: 'Insights', icon: Sparkles, module: 'insights' },
      { href: '/projects', label: 'Projects', icon: FolderOpen, module: 'projects' },
      { href: '/documents', label: 'Documents', icon: FileArchive, module: 'documents' },
      {
        href: '/reports', label: 'Reports', icon: BarChart2, module: 'reports',
        children: [
          { href: '/reports', label: 'Standard Reports', icon: BarChart2 },
          { href: '/reports/builder', label: 'Report Builder', icon: Sparkles },
        ],
      },
      {
        href: '/workflow', label: 'Approvals', icon: Workflow, module: 'workflow',
        children: [
          { href: '/workflow', label: 'Approval Queue', icon: CheckSquare },
          { href: '/workflow/definitions', label: 'Definitions', icon: GitBranch },
        ],
      },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/audit', label: 'Audit Trail', icon: Shield, module: 'audit' },
      { href: '/settings', label: 'Settings', icon: Settings, module: 'settings' },
      { href: '/help', label: 'Help & User Manual', icon: HelpCircle },
    ],
  },
]

const QUICK_CREATE = [
  { label: 'Invoice', href: '/sales/invoices/new', icon: FileText },
  { label: 'Sales Order', href: '/sales/orders/new', icon: TrendingUp },
  { label: 'Purchase Order', href: '/procurement/purchase-orders/new', icon: ShoppingCart },
  { label: 'Customer', href: '/sales/customers/new', icon: Users },
  { label: 'Payment', href: '/sales/payments', icon: CreditCard },
  { label: 'Expense', href: '/expenses', icon: Receipt },
  { label: 'Transfer', href: '/inventory/transfers', icon: ArrowLeftRight },
  { label: 'Employee', href: '/hr/employees', icon: User },
]

function allNavItems(): Array<{ href: string; label: string; icon: React.ElementType; module?: string }> {
  const items: Array<{ href: string; label: string; icon: React.ElementType; module?: string }> = []
  for (const g of navGroups) {
    for (const item of g.items) {
      items.push({ href: item.href, label: item.label, icon: item.icon, module: item.module })
      if (item.children) {
        for (const child of item.children) items.push({ href: child.href, label: child.label, icon: child.icon })
      }
    }
  }
  return items
}

const ALL_ITEMS = allNavItems()

function findItem(href: string) {
  return ALL_ITEMS.find((i) => i.href === href)
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

const RECENTS_KEY = 'erp_recents'
const PINS_KEY = 'erp_pins'
const MAX_RECENTS = 5

export function Sidebar() {
  const userRole = useAppStore((s) => s.userRole)
  const userName = useAppStore((s) => s.userName)
  const allowedModules = useAppStore((s) => s.allowedModules)
  const allowedSubmodules = useAppStore((s) => s.allowedSubmodules)
  const pathname = usePathname()
  const branding = useCompanyBranding()
  const [collapsed, setCollapsed] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const init: string[] = []
    if (pathname.startsWith('/inventory')) init.push('/inventory')
    if (pathname.startsWith('/hr')) init.push('/hr')
    if (pathname.startsWith('/finance')) init.push('/finance')
    if (pathname.startsWith('/procurement')) init.push('/procurement')
    if (pathname.startsWith('/reports')) init.push('/reports')
    if (pathname.startsWith('/workflow')) init.push('/workflow')
    if (pathname.startsWith('/fulfillment')) init.push('/fulfillment')
    return new Set(init)
  })
  const [recents, setRecents] = useState<string[]>([])
  const [pins, setPins] = useState<string[]>([])
  const [showQuickCreate, setShowQuickCreate] = useState(false)

  useEffect(() => {
    try {
      const r = localStorage.getItem(RECENTS_KEY)
      if (r) setRecents(JSON.parse(r))
      const p = localStorage.getItem(PINS_KEY)
      if (p) setPins(JSON.parse(p))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!pathname || pathname === '/') return
    setRecents((prev) => {
      const next = [pathname, ...prev.filter((p) => p !== pathname)].slice(0, MAX_RECENTS)
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [pathname])

  const togglePin = useCallback((href: string) => {
    setPins((prev) => {
      const next = prev.includes(href) ? prev.filter((p) => p !== href) : [...prev, href]
      try { localStorage.setItem(PINS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const toggleGroup = (href: string) => {
    setExpandedGroups((prev) => {
      if (prev.has(href)) { return new Set() }
      return new Set([href])
    })
  }

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.map((item) => {
        const modAllowed = !item.module
          ? true
          : allowedModules != null
            ? allowedModules.includes(item.module)
            : hasPermission(userRole, item.module)
        if (!modAllowed) return null
        if (!item.children || !allowedSubmodules || !item.module) return item
        const allowedModSubs = allowedSubmodules[item.module]
        if (!allowedModSubs || allowedModSubs.length === 0) return item
        const filteredChildren = item.children.filter((child) => {
          const seg = child.href.split('/').filter(Boolean).pop()!
          return allowedModSubs.includes(seg)
        })
        if (filteredChildren.length === 0) return null
        return { ...item, children: filteredChildren }
      }).filter(Boolean) as NavItem[],
    }))
    .filter((group) => group.items.length > 0)

  const pinnedItems = pins.map((h) => findItem(h)).filter(Boolean) as typeof ALL_ITEMS

  return (
    <aside
        className={cn(
          'relative flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] min-h-screen',
          'bg-[var(--sidebar-bg)] border-r border-slate-200/80',
          collapsed ? 'w-[60px]' : 'w-[240px]'
        )}
    >
      <div className={cn(
        'flex items-center border-b border-slate-200/80 h-14 flex-shrink-0',
        collapsed ? 'justify-center px-3' : 'px-3 gap-2.5'
      )}>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#3B82F6] shadow-md shadow-blue-500/20">
          {branding.logo ? (
            <img src={branding.logo} alt={branding.name} className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-4 w-4 text-white" />
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--sidebar-text)] leading-none tracking-tight">{branding.name}</p>
            <p className="text-[10px] text-[var(--sidebar-text-secondary)] mt-0.5 font-medium">Enterprise Suite</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-[var(--sidebar-text-secondary)] hover:text-[var(--sidebar-text)]/60 hover:bg-[var(--sidebar-hover-bg)] transition-all duration-200 flex-shrink-0 active:scale-95"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 py-2.5 border-b border-slate-200/80 flex-shrink-0 relative">
          <button
            onClick={() => setShowQuickCreate((v) => !v)}
            className="flex w-full items-center gap-2 rounded-xl bg-white/70 border border-slate-200/80 px-3 py-2 text-xs font-medium text-[var(--sidebar-text)] hover:bg-white transition-all duration-200 active:scale-[0.98] shadow-sm"
          >
            <Plus className="h-3.5 w-3.5 text-[#3B82F6]" />
            Quick Create
            <ChevronDown className={cn('ml-auto h-3 w-3 text-[var(--sidebar-text-secondary)] transition-transform duration-200', showQuickCreate && 'rotate-180')} />
          </button>

          <div className={cn(
            'absolute left-3 right-3 top-full mt-1.5 z-50 rounded-xl bg-white border border-slate-200/80 shadow-soft-lg overflow-hidden transition-all duration-200 ease-out',
            showQuickCreate ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
          )}>
            {QUICK_CREATE.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowQuickCreate(false)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-[11px] text-[var(--sidebar-text-secondary)] hover:text-[var(--sidebar-text)] hover:bg-slate-50 transition-all duration-150 border-b border-slate-100 last:border-0"
              >
                <item.icon className="h-3.5 w-3.5 flex-shrink-0 text-[#3B82F6]" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">

        {!collapsed && pinnedItems.length > 0 && (
          <div className="mb-1">
            <p className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--sidebar-text-secondary)]/50 select-none flex items-center gap-1.5">
              <Pin className="h-2.5 w-2.5" /> Pinned
            </p>
            <div className="space-y-0.5 px-2">
              {pinnedItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <div key={item.href} className="group relative">
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all duration-150 pr-8',
                        isActive ? 'text-[var(--sidebar-active-text)] font-semibold bg-[var(--sidebar-active-bg)]' : 'text-[var(--sidebar-icon-default)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)]'
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                    <button
                      onClick={() => togglePin(item.href)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded text-[var(--sidebar-text-secondary)]/40 hover:text-[#FFD60A] transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="mx-3 mt-2 h-px bg-slate-200/60" />
          </div>
        )}

        {!collapsed && recents.length > 0 && (
          <div className="mb-1">
            <p className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--sidebar-text-secondary)]/50 select-none flex items-center gap-1.5">
              <History className="h-2.5 w-2.5" /> Recents
            </p>
            <div className="space-y-0.5 px-2">
              {recents.map((href) => {
                const item = findItem(href)
                if (!item) return null
                const isActive = pathname === href
                return (
                  <div key={href} className="group relative">
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all duration-150 pr-8',
                        isActive ? 'text-[var(--sidebar-active-text)] font-semibold bg-[var(--sidebar-active-bg)]' : 'text-[var(--sidebar-icon-default)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)]/60'
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                    <button
                      onClick={() => togglePin(href)}
                      className={cn(
                        'absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded transition-colors',
                        pins.includes(href) ? 'text-[#FFD60A]' : 'text-[var(--sidebar-text-secondary)]/40 hover:text-[#FFD60A]'
                      )}
                    >
                      <Pin className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="mx-3 mt-2 h-px bg-slate-200/60" />
          </div>
        )}

        {visibleGroups.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && 'mt-1')}>
            {!collapsed && (
              <p className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--sidebar-text-secondary)]/50 select-none">
                {group.label}
              </p>
            )}
            {collapsed && gi > 0 && (
              <div className="mx-3 my-2 h-px bg-slate-200/60" />
            )}

            <div className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const isGroupActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const isExpanded = expandedGroups.has(item.href)

                if (item.children) {
                  if (collapsed) {
                    return (
                      <Link
                        key={item.href}
                        href={item.children[0].href}
                        className={cn(
                          'flex items-center justify-center rounded-xl p-2 transition-all duration-150',
                          isGroupActive ? 'text-[var(--sidebar-active-text)] bg-[var(--sidebar-active-bg)]' : 'text-[var(--sidebar-icon-default)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)]'
                        )}
                        title={item.label}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                      </Link>
                    )
                  }

                  return (
                    <div key={item.href}>
                      <button
                        onClick={() => toggleGroup(item.href)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
                          isGroupActive ? 'text-[var(--sidebar-active-text)] font-semibold bg-[var(--sidebar-active-bg)]' : 'text-[var(--sidebar-icon-default)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)]'
                        )}
                      >
                        <item.icon className={cn('h-4 w-4 flex-shrink-0')} />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        <ChevronDown className={cn('h-3 w-3 flex-shrink-0 text-[var(--sidebar-icon-default)]/50 transition-transform duration-200', isExpanded && 'rotate-180')} />
                      </button>

                      <div
                        className={cn(
                          'grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        )}
                      >
                        <div className="overflow-hidden">
                          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2.5">
                            {item.children.map((child) => {
                              const childActive = pathname === child.href
                              return (
                                <div key={child.href} className="group relative">
                                  <Link
                                    href={child.href}
                                    className={cn(
                                      'flex items-center gap-2 rounded-xl px-2 py-1.5 text-[11px] transition-all duration-150 pr-7',
                                      childActive ? 'text-[var(--sidebar-active-text)] font-semibold bg-[var(--sidebar-active-bg)]' : 'text-[var(--sidebar-icon-default)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)]'
                                    )}
                                  >
                                    <child.icon className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{child.label}</span>
                                  </Link>
                                  <button
                                    onClick={() => togglePin(child.href)}
                                    className={cn(
                                      'absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex h-4 w-4 items-center justify-center rounded transition-colors',
                                      pins.includes(child.href) ? 'text-[#FFD60A]' : 'text-[var(--sidebar-text-secondary)]/40 hover:text-[#FFD60A]'
                                    )}
                                  >
                                    <Pin className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }

                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <div key={item.href} className="group relative">
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
                        isActive ? 'text-[var(--sidebar-active-text)] font-semibold bg-[var(--sidebar-active-bg)]' : 'text-[var(--sidebar-icon-default)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)]',
                        collapsed ? 'justify-center px-2' : ''
                      )}
                    >
                      <item.icon className={cn('h-4 w-4 flex-shrink-0')} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                    {!collapsed && (
                      <button
                        onClick={() => togglePin(item.href)}
                        className={cn(
                          'absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded transition-colors',
                          pins.includes(item.href) ? 'text-[#FFD60A]' : 'text-[var(--sidebar-text-secondary)]/40 hover:text-[#FFD60A]'
                        )}
                      >
                        <Pin className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200/80 p-2 flex-shrink-0">
        {collapsed ? (
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center justify-center rounded-xl p-2 text-[var(--sidebar-text-secondary)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] transition-all duration-150 active:scale-95"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <div className="rounded-xl bg-white/70 border border-slate-200/80 p-2.5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#3B82F6] text-[10px] font-bold text-white shadow-md shadow-blue-500/20">
                {getInitials(userName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--sidebar-text)] truncate leading-none tracking-tight">{userName}</p>
                <p className="text-[10px] text-[var(--sidebar-text-secondary)] truncate mt-0.5 font-medium">{userRole ? ROLE_LABELS[userRole] : ''}</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Link
                href="/dashboard"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[var(--sidebar-text-secondary)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] transition-all duration-150 active:scale-95"
              >
                <User className="h-3 w-3" />
                Profile
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[var(--sidebar-text-secondary)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] transition-all duration-150 active:scale-95"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}