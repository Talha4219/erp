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
  BookOpen, Layers,
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

const MODULE_ACCENT: Record<string, string> = {
  dashboard: 'bg-indigo-500',
  pos: 'bg-amber-500',
  crm: 'bg-violet-500',
  customers: 'bg-blue-500',
  sales: 'bg-emerald-500',
  procurement: 'bg-teal-500',
  inventory: 'bg-orange-500',
  fulfillment: 'bg-blue-600',
  finance: 'bg-green-500',
  expenses: 'bg-rose-500',
  hr: 'bg-pink-500',
  projects: 'bg-cyan-500',
  documents: 'bg-yellow-500',
  reports: 'bg-purple-500',
  insights: 'bg-sky-500',
  workflow: 'bg-lime-500',
  audit: 'bg-red-600',
  settings: 'bg-gray-400',
}

// Quick-create actions (module → create URL)
const QUICK_CREATE = [
  { label: 'Purchase Order', href: '/procurement/purchase-orders/new', icon: ShoppingCart, color: 'text-teal-400' },
  { label: 'Purchase Request', href: '/procurement/purchase-requests', icon: ClipboardList, color: 'text-purple-400' },
  { label: 'Sales Order', href: '/sales/orders', icon: TrendingUp, color: 'text-emerald-400' },
  { label: 'Sales Invoice', href: '/sales/invoices', icon: FileText, color: 'text-blue-400' },
  { label: 'Journal Entry', href: '/finance/journal', icon: BookOpen, color: 'text-green-400' },
  { label: 'Employee', href: '/hr/employees', icon: User, color: 'text-pink-400' },
  { label: 'Inventory Transfer', href: '/inventory/transfers', icon: ArrowLeftRight, color: 'text-orange-400' },
  { label: 'Fulfillment Order', href: '/fulfillment/orders', icon: Truck, color: 'text-blue-400' },
  { label: 'Vehicle', href: '/fulfillment/vehicles', icon: Truck, color: 'text-gray-400' },
  { label: 'Driver', href: '/fulfillment/drivers', icon: User, color: 'text-green-400' },
]

// Flatten all nav items for lookup
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

  // Load from localStorage
  useEffect(() => {
    try {
      const r = localStorage.getItem(RECENTS_KEY)
      if (r) setRecents(JSON.parse(r))
      const p = localStorage.getItem(PINS_KEY)
      if (p) setPins(JSON.parse(p))
    } catch { /* ignore */ }
  }, [])

  // Track recents
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
        'relative flex flex-col bg-[#0f1117] text-gray-100 transition-all duration-300 ease-in-out min-h-screen border-r border-white/5',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* Logo + collapse */}
      <div className={cn(
        'flex items-center border-b border-white/5 h-14 flex-shrink-0',
        collapsed ? 'justify-center px-3' : 'px-3 gap-2.5'
      )}>
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/30">
          {branding.logo ? (
            <img src={branding.logo} alt={branding.name} className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-4 w-4 text-white" />
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white leading-none">{branding.name}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Business Suite</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1 text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors flex-shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Quick Create */}
      {!collapsed && (
        <div className="px-3 py-2.5 border-b border-white/5 flex-shrink-0 relative">
          <button
            onClick={() => setShowQuickCreate((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-600/30 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Quick Create
            <ChevronDown className={cn('ml-auto h-3 w-3 transition-transform', showQuickCreate && 'rotate-180')} />
          </button>

          {showQuickCreate && (
            <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-xl border border-white/10 bg-[#1a1d26] shadow-2xl shadow-black/40 overflow-hidden">
              {QUICK_CREATE.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowQuickCreate(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-gray-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0"
                >
                  <item.icon className={cn('h-3.5 w-3.5 flex-shrink-0', item.color)} />
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">

        {/* Pinned */}
        {!collapsed && pinnedItems.length > 0 && (
          <div className="mb-1">
            <p className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-widest text-gray-600 select-none flex items-center gap-1.5">
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
                        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all pr-8',
                        isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                    <button
                      onClick={() => togglePin(item.href)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded text-gray-600 hover:text-amber-400 transition-colors"
                      title="Unpin"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="mx-3 mt-2 h-px bg-white/5" />
          </div>
        )}

        {/* Recents */}
        {!collapsed && recents.length > 0 && (
          <div className="mb-1">
            <p className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-widest text-gray-600 select-none flex items-center gap-1.5">
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
                        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all pr-8',
                        isActive ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                    <button
                      onClick={() => togglePin(href)}
                      className={cn(
                        'absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded transition-colors',
                        pins.includes(href) ? 'text-amber-400' : 'text-gray-600 hover:text-amber-400'
                      )}
                      title={pins.includes(href) ? 'Unpin' : 'Pin'}
                    >
                      <Pin className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="mx-3 mt-2 h-px bg-white/5" />
          </div>
        )}

        {/* Main nav groups */}
        {visibleGroups.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && 'mt-1')}>
            {!collapsed && (
              <p className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-widest text-gray-600 select-none">
                {group.label}
              </p>
            )}
            {collapsed && gi > 0 && (
              <div className="mx-3 my-2 h-px bg-white/5" />
            )}

            <div className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const isGroupActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const isExpanded = expandedGroups.has(item.href)
                const accent = MODULE_ACCENT[item.module ?? ''] ?? 'bg-indigo-500'

                if (item.children) {
                  if (collapsed) {
                    return (
                      <Link
                        key={item.href}
                        href={item.children[0].href}
                        className={cn(
                          'flex items-center justify-center rounded-md p-2 transition-all',
                          isGroupActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
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
                          'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                          isGroupActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                        )}
                      >
                        {isGroupActive && <span className={cn('w-1 h-1 rounded-full flex-shrink-0', accent)} />}
                        <item.icon className={cn('h-4 w-4 flex-shrink-0', !isGroupActive && 'ml-3')} />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        <ChevronDown className={cn('h-3 w-3 flex-shrink-0 text-gray-500 transition-transform', isExpanded && 'rotate-180')} />
                      </button>

                      {isExpanded && (
                        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-2.5">
                          {item.children.map((child) => {
                            const childActive = pathname === child.href
                            return (
                              <div key={child.href} className="group relative">
                                <Link
                                  href={child.href}
                                  className={cn(
                                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-all pr-7',
                                    childActive ? 'bg-white/10 text-white font-medium' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                                  )}
                                >
                                  <child.icon className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{child.label}</span>
                                </Link>
                                <button
                                  onClick={() => togglePin(child.href)}
                                  className={cn(
                                    'absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex h-4 w-4 items-center justify-center rounded transition-colors',
                                    pins.includes(child.href) ? 'text-amber-400' : 'text-gray-600 hover:text-amber-400'
                                  )}
                                  title={pins.includes(child.href) ? 'Unpin' : 'Pin'}
                                >
                                  <Pin className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
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
                        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                        isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200',
                        collapsed ? 'justify-center px-2' : !isActive && 'pr-8'
                      )}
                    >
                      {isActive && !collapsed && (
                        <span className={cn('w-1 h-1 rounded-full flex-shrink-0', accent)} />
                      )}
                      <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive || collapsed ? '' : 'ml-3')} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                    {!collapsed && (
                      <button
                        onClick={() => togglePin(item.href)}
                        className={cn(
                          'absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded transition-colors',
                          pins.includes(item.href) ? 'text-amber-400' : 'text-gray-600 hover:text-amber-400'
                        )}
                        title={pins.includes(item.href) ? 'Unpin' : 'Pin'}
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

      {/* User section */}
      <div className="border-t border-white/5 p-2 flex-shrink-0">
        {collapsed ? (
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center justify-center rounded-md p-2 text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <div className="rounded-lg bg-white/5 p-2.5">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white shadow-md">
                {getInitials(userName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate leading-none">{userName}</p>
                <p className="text-[10px] text-gray-500 truncate mt-0.5">{userRole ? ROLE_LABELS[userRole] : ''}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Link
                href="/dashboard"
                className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <User className="h-3 w-3" />
                Profile
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
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
