'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bell, Check, CheckCheck, Search, X, ChevronRight, Plus, Settings,
  User, LogOut, ShoppingCart, ClipboardList, TrendingUp, FileText,
  BookOpen, Users, ArrowLeftRight, ChevronDown,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useRouter, usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useAppStore } from '@/lib/stores/app-store'
import Link from 'next/link'
import { toast } from 'sonner'

type Notification = {
  id: string
  title: string
  body: string
  type: string
  isRead: boolean
  actionUrl?: string | null
  createdAt: string
}

type SearchResult = {
  id: string
  type: string
  label: string
  subLabel?: string
  href: string
}

const TYPE_DOT: Record<string, string> = {
  SUCCESS: 'bg-emerald-500',
  ERROR: 'bg-red-500',
  WARNING: 'bg-amber-500',
  ACTION_REQUIRED: 'bg-blue-500',
  INFO: 'bg-gray-400',
  REMINDER: 'bg-purple-500',
}

const RESULT_BADGE: Record<string, string> = {
  Customer: 'text-blue-700 bg-blue-50 border border-blue-200',
  Vendor: 'text-violet-700 bg-violet-50 border border-violet-200',
  Item: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  'Sales Order': 'text-orange-700 bg-orange-50 border border-orange-200',
  Invoice: 'text-teal-700 bg-teal-50 border border-teal-200',
  'Purchase Order': 'text-indigo-700 bg-indigo-50 border border-indigo-200',
  Employee: 'text-pink-700 bg-pink-50 border border-pink-200',
  Journal: 'text-gray-700 bg-gray-100 border border-gray-200',
}

// Quick-create options
const QUICK_CREATES = [
  {
    group: 'Procurement',
    items: [
      { label: 'Purchase Order', href: '/procurement/purchase-orders/new', icon: ShoppingCart },
      { label: 'Purchase Request', href: '/procurement/purchase-requests', icon: ClipboardList },
    ],
  },
  {
    group: 'Sales',
    items: [
      { label: 'Sales Order', href: '/sales/orders', icon: TrendingUp },
      { label: 'Sales Invoice', href: '/sales/invoices', icon: FileText },
    ],
  },
  {
    group: 'Finance',
    items: [
      { label: 'Journal Entry', href: '/finance/journal', icon: BookOpen },
    ],
  },
  {
    group: 'HR & Inventory',
    items: [
      { label: 'Employee', href: '/hr/employees', icon: Users },
      { label: 'Inventory Transfer', href: '/inventory/transfers', icon: ArrowLeftRight },
    ],
  },
]

function useBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  const LABELS: Record<string, string> = {
    dashboard: 'Dashboard', pos: 'Point of Sale', crm: 'CRM',
    customers: 'Customers', 'business-partners': 'Business Partners',
    sales: 'Sales', orders: 'Orders', invoices: 'Invoices',
    'delivery-notes': 'Delivery Notes', procurement: 'Purchasing',
    'purchase-requests': 'Purchase Requests', 'approval-center': 'Approval Center',
    rfqs: 'RFQs', 'supplier-quotations': 'Quotations',
    'purchase-orders': 'Purchase Orders', 'goods-receipt': 'Goods Receipt',
    'purchase-invoices': 'Invoices', 'vendor-payments': 'Payments',
    returns: 'Returns', vendors: 'Suppliers', 'supplier-contacts': 'Contacts',
    'supplier-ratings': 'Ratings', inventory: 'Inventory', items: 'Items',
    warehouses: 'Warehouses', 'stock-ledger': 'Stock Ledger', batches: 'Batches',
    transfers: 'Transfers', 'cycle-counts': 'Cycle Counts', valuation: 'Valuation',
    'serial-numbers': 'Serial Numbers', uom: 'Units of Measure', variants: 'Variants',
    finance: 'Finance', accounts: 'Chart of Accounts', 'bank-accounts': 'Bank Accounts',
    journal: 'Journal Entries', 'tax-rates': 'Tax Rates', currencies: 'Currencies',
    'cost-centres': 'Cost Centres', 'fixed-assets': 'Fixed Assets', reports: 'Reports',
    'trial-balance': 'Trial Balance', pnl: 'P&L Statement',
    'balance-sheet': 'Balance Sheet', 'ar-aging': 'AR Ageing', 'ap-aging': 'AP Ageing',
    'fiscal-years': 'Fiscal Years', 'bank-reconciliation': 'Bank Reconciliation',
    hr: 'Human Resources', employees: 'Employees', attendance: 'Attendance',
    biometric: 'Biometric', payroll: 'Payroll', components: 'Components',
    recruitment: 'Recruitment', expenses: 'Expenses', projects: 'Projects',
    documents: 'Documents', workflow: 'Approvals', definitions: 'Definitions',
    builder: 'Report Builder', audit: 'Audit Trail', settings: 'Settings',
  }

  return segments.map((seg, idx) => ({
    label: LABELS[seg] ?? (seg.length === 24 ? '…' : seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())),
    href: '/' + segments.slice(0, idx + 1).join('/'),
  }))
}

function getInitials(name?: string) {
  if (!name) return 'U'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export function Header() {
  const router = useRouter()
  const breadcrumbs = useBreadcrumb()
  const userName = useAppStore((s) => s.userName)
  const userEmail = useAppStore((s) => s.userEmail)

  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const createRef = useRef<HTMLDivElement>(null)

  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)


  async function load() {
    try {
      const res = await fetch('/api/notifications?limit=15')
      const json = await res.json()
      if (json.success) {
        setNotifications(json.data)
        setUnread(json.unreadCount)
      }
    } catch { /* silent */ }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
      if (createRef.current && !createRef.current.contains(e.target as Node)) setCreateOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setCreateOpen(false)
        setNotifOpen(false)
        setProfileOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); setSearchOpen(false); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.success) {
        setSearchResults(json.data)
        setSearchOpen(true)
        setActiveIndex(-1)
      }
    } catch { /* silent */ } finally { setSearching(false) }
  }, [])

  function handleQueryChange(v: string) {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.length < 2) { setSearchResults([]); setSearchOpen(false); return }
    debounceRef.current = setTimeout(() => doSearch(v), 300)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchOpen || !searchResults.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, searchResults.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      const r = searchResults[activeIndex]
      if (r) { router.prefetch(r.href); router.push(r.href); setSearchOpen(false); setQuery('') }
    }
  }

  function markAllRead() {
    const prev = notifications
    const prevUnread = unread
    setNotifications((n) => n.map((x) => ({ ...x, isRead: true })))
    setUnread(0)
    fetch('/api/notifications', { method: 'PATCH' }).catch(() => {
      setNotifications(prev)
      setUnread(prevUnread)
      toast.error('Failed to mark all as read')
    })
  }

  function markRead(id: string) {
    const prev = notifications
    const prevUnread = unread
    setNotifications((n) => n.map((x) => (x.id === id ? { ...x, isRead: true } : x)))
    setUnread((c) => Math.max(0, c - 1))
    fetch(`/api/notifications/${id}`, { method: 'PATCH' }).catch(() => {
      setNotifications(prev)
      setUnread(prevUnread)
      toast.error('Failed to mark notification as read')
    })
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-xl px-6 md:px-8 gap-3 flex-shrink-0 sticky top-0 z-30">
      {/* Breadcrumb */}
      <nav className="hidden md:flex items-center gap-1 min-w-0 flex-1" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />}
            {i === breadcrumbs.length - 1 ? (
              <span className="text-sm font-semibold text-foreground/90 truncate">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-sm text-muted-foreground hover:text-foreground/70 transition-colors truncate">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Search */}
      <div className="relative flex-1 max-w-lg mx-auto" ref={searchRef}>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#3B82F6] transition-colors" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search customers, orders, items… (Ctrl K)"
            className="h-10 w-full rounded-2xl bg-white py-0 pl-11 pr-8 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#3B82F6]/20 transition-all border border-slate-200/80 shadow-soft"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => { if (searchResults.length) setSearchOpen(true) }}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-muted-foreground transition-colors"
              onClick={() => { setQuery(''); setSearchResults([]); setSearchOpen(false); inputRef.current?.focus() }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className={cn(
          'absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl glass shadow-glass overflow-hidden transition-all duration-200 ease-out',
          searchOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
        )}>
            {searching ? (
              <div className="px-4 py-3 text-sm text-muted-foreground/90">Searching…</div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground/90">No results for &ldquo;{query}&rdquo;</div>
            ) : (
              <ul className="max-h-72 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-border/60 last:border-0',
                        i === activeIndex ? 'bg-accent/80' : 'hover:bg-accent'
                      )}
                      onMouseEnter={() => router.prefetch(r.href)}
                      onClick={() => { router.prefetch(r.href); router.push(r.href); setSearchOpen(false); setQuery('') }}
                    >
                      <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wide flex-shrink-0 whitespace-nowrap', RESULT_BADGE[r.type] ?? 'bg-accent text-muted-foreground/90')}>
                        {r.type}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-foreground/80 truncate">{r.label}</span>
                        {r.subLabel && <span className="block text-xs text-muted-foreground truncate">{r.subLabel}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">

        {/* Quick Create */}
        <div className="relative" ref={createRef}>
          <button
            onClick={() => setCreateOpen((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium transition-all border border-slate-200/80',
              createOpen
                ? 'bg-white text-slate-800 shadow-soft'
                : 'bg-white/80 text-slate-500 hover:text-slate-800 hover:shadow-soft'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', createOpen && 'rotate-180')} />
          </button>

          <div className={cn(
            'absolute right-0 top-full mt-1.5 z-50 w-64 rounded-2xl glass shadow-glass overflow-hidden transition-all duration-200 ease-out',
            createOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
          )}>
              {QUICK_CREATES.map((group) => (
                <div key={group.group} className="border-b border-border/60 last:border-0">
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 bg-muted/50">
                    {group.group}
                  </p>
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onMouseEnter={() => router.prefetch(item.href)}
                      onClick={() => setCreateOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground/70 hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/20">
                        <item.icon className="h-3.5 w-3.5 text-[#007AFF]" />
                      </div>
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            className={cn(
              'relative flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200/80 text-slate-500 hover:text-slate-800 hover:shadow-soft transition-all',
              notifOpen && 'shadow-soft text-slate-800'
            )}
            onClick={() => { setNotifOpen((o) => !o); if (!notifOpen) load() }}
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-foreground ring-2 ring-background">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          <div className={cn(
            'absolute right-0 top-10 z-50 w-80 rounded-2xl glass shadow-glass overflow-hidden transition-all duration-200 ease-out',
            notifOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
          )}>
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground/90">Notifications</span>
                  {unread > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-foreground">
                      {unread}
                    </span>
                  )}
                </div>
                {unread > 0 && (
                  <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-[#007AFF] hover:text-blue-400 transition-colors">
                    <CheckCheck className="h-3 w-3" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">No notifications</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'flex gap-3 px-4 py-3 cursor-pointer hover:bg-accent transition-colors',
                        !n.isRead && 'bg-blue-500/[0.08]'
                      )}
                      onClick={() => { markRead(n.id); setNotifOpen(false); if (n.actionUrl) { router.prefetch(n.actionUrl); router.push(n.actionUrl) } }}
                    >
                      <div className={cn('mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full', TYPE_DOT[n.type] ?? 'bg-muted-foreground/30')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm truncate', !n.isRead ? 'font-semibold text-foreground' : 'text-foreground/70')}>{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">{formatDate(n.createdAt)}</p>
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markRead(n.id) }}
                          className="flex-shrink-0 mt-1 text-muted-foreground/70 hover:text-[#007AFF] transition-colors"
                          title="Mark read"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
        </div>

        {/* Profile menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-[11px] font-bold text-white transition-all shadow-md shadow-blue-500/20 ring-2 ring-transparent hover:ring-[#3B82F6]/30',
              profileOpen && 'ring-[#3B82F6]/30'
            )}
          >
            {getInitials(userName)}
          </button>

          <div className={cn(
            'absolute right-0 top-10 z-50 w-56 rounded-2xl glass shadow-glass overflow-hidden transition-all duration-200 ease-out',
            profileOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
          )}>
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground/90 truncate">{userName ?? 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
              <div className="py-1">
                <Link
                  href="/dashboard"
                  onMouseEnter={() => router.prefetch('/dashboard')}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/70 hover:text-foreground hover:bg-accent transition-colors"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  My Profile
                </Link>
                <Link
                  href="/settings"
                  onMouseEnter={() => router.prefetch('/settings')}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/70 hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Settings
                </Link>
              </div>
              <div className="border-t border-border py-1">
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-destructive hover:text-destructive/80 hover:bg-accent transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
        </div>
      </div>
    </header>
  )
}
