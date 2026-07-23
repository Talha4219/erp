'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api-client'
import { formatCurrency, ROLE_PERMISSIONS, formatDate } from '@/lib/utils'
import type { Role } from '@prisma/client'
import { formatGBP } from '@/lib/uk-locale'
import { getAppCurrencySymbol } from '@/lib/currency-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'

const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false })
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false })
const ComposedChart = dynamic(() => import('recharts').then(m => m.ComposedChart), { ssr: false })
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false })
import {
  ShoppingCart, Clock, AlertTriangle, TrendingUp,
  Package, BarChart2, ArrowRight, Bell, CheckCircle, Workflow,
  Banknote, CreditCard, Users, Building2, ArrowUpRight, ArrowDownRight,
  Activity, User, Mail, Phone, MapPin, Edit2, Save, ShieldOff,
  Leaf, ChevronRight, Truck, Receipt,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

// ── Constants ─────────────────────────────────────────────────────────────────
const CHART_COLORS = {
  blue: '#3b82f6', emerald: '#10b981', amber: '#f59e0b',
  red: '#ef4444', violet: '#8b5cf6', teal: '#14b8a6', indigo: '#6366f1',
}

const NOTIF_COLORS: Record<string, string> = {
  SUCCESS: 'bg-emerald-500', ERROR: 'bg-red-500', WARNING: 'bg-amber-500',
  INFO: 'bg-blue-500', REMINDER: 'bg-purple-500',
}

const MODULE_COLORS: Record<string, string> = {
  sales: 'bg-emerald-100 text-emerald-700', procurement: 'bg-teal-100 text-teal-700',
  finance: 'bg-blue-100 text-blue-700', hr: 'bg-pink-100 text-pink-700',
  inventory: 'bg-orange-100 text-orange-700',
}

// ── Types ─────────────────────────────────────────────────────────────────────
type RetailKpis = {
  todaySales: number; lastYearSameDay: number; salesVariancePct: number
  weekSales: number; mtdSales: number
  mtdNetSales: number; mtdCogs: number; grossProfitMtd: number; grossProfitMtdPct: number
  todayTransactionCount: number; avgTransactionValue: number
  wageCostRatio: number; wasteValueToday: number; lowStockCount: number; expiryAlerts7Day: number
}

type YearlyMonth = { month: number; label: string; revenue: number; expenses: number; profit: number }

type DashboardData = {
  kpis: {
    revenueMTD: number; openPOs: number; pendingLeaves: number; lowStockAlerts: number
    revenueToday: number; revenueMTDFromPayments: number; pendingApprovals: number
    openSalesOrders: number; apDueThisWeek: number; arOutstanding: number; cashPosition: number
  }
  arAging: { current: number; days30: number; days60: number; days90plus: number }
  monthlyRevenue: Array<{ month: string; year: number; revenue: number }>
  lowStockItems: Array<{ id: string; name: string; sku: string; reorderPoint: number; currentStock: number }>
  expenseBreakdown: Array<{ name: string; value: number }>
  recentActivity: Array<{ id: string; type: string; description: string; amount: number; date: string; status: string }>
  bankAccounts: Array<{ id: string; accountName: string; accountType: string; currentBalance: number; currency: string }>
  recentNotifications: Array<{ id: string; title: string; body: string; type: string; isRead: boolean; createdAt: string; actionUrl: string | null }>
  pendingWorkflow: Array<{ id: string; workflow: string; module: string; requester: string; requestedAt: string; status: string }>
  topCustomers: Array<{ name: string; total: number }>
  workflowAlerts: {
    approvals: Array<{ label: string; count: number; href: string }>
    financial: Array<{ label: string; count: number; href: string }>
    inventory: Array<{ label: string; count: number; href: string }>
  }
  myTasks: Array<{ id: string; workflow: string; module: string; requester: string; requestedAt: string }>
}

type UserProfile = {
  id: string; name: string | null; email: string; phone: string | null
  avatarUrl: string | null; address: string | null; bio: string | null
  onboardingDone: boolean; role: string; createdAt: string; lastLoginAt: string | null
  branch: { id: string; name: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getGreeting(name?: string | null) {
  const h = new Date().getHours()
  const salutation = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : h < 21 ? 'Good Evening' : 'Good Night'
  const first = name?.split(' ')[0] ?? 'there'
  return { salutation, first }
}

function formatFullDate() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function computeHealthScore(kpis?: DashboardData['kpis'], arAging?: DashboardData['arAging']): number {
  if (!kpis) return 70
  let score = 100
  if ((arAging?.days90plus ?? 0) > 0) score -= 20
  if (kpis.cashPosition <= 0) score -= 25
  if (kpis.lowStockAlerts > 10) score -= 15
  else if (kpis.lowStockAlerts > 3) score -= 8
  if (kpis.apDueThisWeek > kpis.cashPosition) score -= 10
  return Math.max(20, Math.min(100, score))
}

// ── Sub-components ────────────────────────────────────────────────────────────
const ACCENT_ICON: Record<string, string> = {
  'bg-emerald-500': 'bg-emerald-50 text-emerald-600',
  'bg-blue-500': 'bg-blue-50 text-blue-600',
  'bg-teal-500': 'bg-teal-50 text-teal-600',
  'bg-amber-500': 'bg-amber-50 text-amber-600',
  'bg-orange-500': 'bg-orange-50 text-orange-600',
  'bg-indigo-500': 'bg-indigo-50 text-indigo-600',
  'bg-cyan-500': 'bg-cyan-50 text-cyan-600',
  'bg-violet-500': 'bg-violet-50 text-violet-600',
  'bg-red-500': 'bg-red-50 text-red-600',
  'bg-pink-500': 'bg-pink-50 text-pink-600',
}

function KpiCard({
  title, value, sub, icon: Icon, accent, trend, urgent, onClick, delay = 0,
}: {
  title: string; value: string; sub?: string; icon: React.ElementType
  accent: string; trend?: 'up' | 'down'; urgent?: boolean; onClick?: () => void; delay?: number
}) {
  return (
    <div
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        'animate-fade-up group relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5',
        urgent ? 'border-red-200 bg-red-50/40' : 'border-border/60 hover:border-border',
        onClick && 'cursor-pointer select-none',
      )}
    >
      <div className={cn('absolute inset-x-0 top-0 h-[3px] rounded-t-xl opacity-90', accent)} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 truncate">{title}</p>
          <p className={cn('mt-1.5 text-xl font-bold leading-none tracking-tight', urgent && 'text-red-700')}>{value}</p>
          {sub && (
            <div className="mt-1.5 flex items-center gap-1">
              {trend === 'up' && <ArrowUpRight className="h-3 w-3 shrink-0 text-emerald-500" />}
              {trend === 'down' && <ArrowDownRight className="h-3 w-3 shrink-0 text-red-500" />}
              <span className={cn('text-[11px] truncate', trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground')}>{sub}</span>
            </div>
          )}
        </div>
        <div className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110',
          urgent ? 'bg-red-100 text-red-500' : (ACCENT_ICON[accent] ?? 'bg-muted/40 text-muted-foreground/60'),
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {onClick && <ArrowRight className="absolute bottom-3 right-3 h-3 w-3 text-muted-foreground/20 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />}
    </div>
  )
}

function SectionLabel({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground/40" />}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 whitespace-nowrap">{children}</p>
      <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
    </div>
  )
}

function HealthScore({ score }: { score: number }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
  const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Fair' : 'Needs Attention'
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-14 w-14">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
          <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold text-white">{score}</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-[11px] text-indigo-200">Business Health</p>
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/60 bg-white px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{formatGBP(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function WorkflowPipeline({
  title, stages, icon: Icon, color,
}: {
  title: string
  stages: Array<{ label: string; count?: number; done?: boolean; active?: boolean }>
  icon: React.ElementType
  color: string
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', color)} />
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {stages.map((stage, i) => (
            <div key={stage.label} className="flex items-center min-w-0">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all',
                  stage.done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : stage.active
                      ? 'bg-indigo-500 border-indigo-500 text-white ring-4 ring-indigo-100'
                      : 'bg-white border-border text-muted-foreground',
                )}>
                  {stage.done ? <CheckCircle className="h-4 w-4" /> : stage.count != null ? stage.count : i + 1}
                </div>
                <span className={cn(
                  'text-[10px] font-medium text-center leading-tight whitespace-nowrap',
                  stage.active ? 'text-indigo-600' : stage.done ? 'text-emerald-600' : 'text-muted-foreground',
                )}>{stage.label}</span>
              </div>
              {i < stages.length - 1 && (
                <div className={cn('mx-1 h-0.5 w-8 shrink-0', stage.done ? 'bg-emerald-300' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, avatarUrl, size = 'md' }: { name?: string | null; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-12 w-12 text-sm', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl' }
  const initials = (name ?? 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  if (avatarUrl) return <img src={avatarUrl} alt={name ?? ''} className={cn('rounded-full object-cover ring-2 ring-white shadow-md', sizes[size])} />
  return (
    <div className={cn('rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white ring-2 ring-white shadow-md', sizes[size])}>
      {initials}
    </div>
  )
}

// ── Onboarding form ───────────────────────────────────────────────────────────
function OnboardingForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', phone: '', address: '', bio: '', avatarUrl: '' })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: () => api.patch('/api/users/me', { ...form, onboardingDone: true }),
    onSuccess: (res) => {
      toast.success('Profile saved! Welcome aboard.')
      if (res.success && res.data) qc.setQueryData(['my-profile'], res.data)
      qc.invalidateQueries({ queryKey: ['my-profile'] })
      onDone()
    },
    onError: () => toast.error('Failed to save profile'),
  })

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
            <User className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome! Let&apos;s set up your profile</h1>
          <p className="text-muted-foreground text-sm">Fill in your details so teammates know who you are.</p>
        </div>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/40">
              <Avatar name={form.name || 'You'} avatarUrl={form.avatarUrl || null} size="lg" />
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Profile Picture URL (optional)</Label>
                <Input placeholder="https://example.com/photo.jpg" value={form.avatarUrl} onChange={set('avatarUrl')} className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Full Name *</Label>
                <Input placeholder="Jane Smith" value={form.name} onChange={set('name')} />
              </div>
              <div className="space-y-1">
                <Label>Phone Number</Label>
                <Input placeholder="+44 7700 900123" value={form.phone} onChange={set('phone')} />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input placeholder="London, UK" value={form.address} onChange={set('address')} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Short Bio</Label>
                <Textarea placeholder="Tell your team a bit about yourself…" value={form.bio} onChange={set('bio')} rows={2} className="resize-none" />
              </div>
            </div>
            <Button className="w-full" onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
              {save.isPending ? 'Saving…' : 'Complete Setup & Go to Dashboard'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Profile card ──────────────────────────────────────────────────────────────
function ProfileCard({ profile }: { profile: UserProfile }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: profile.name ?? '', phone: profile.phone ?? '', address: profile.address ?? '', bio: profile.bio ?? '', avatarUrl: profile.avatarUrl ?? '' })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: () => api.patch('/api/users/me', form),
    onSuccess: (res) => { toast.success('Profile updated'); if (res.success && res.data) qc.setQueryData(['my-profile'], res.data); qc.invalidateQueries({ queryKey: ['my-profile'] }); setEditing(false) },
    onError: () => toast.error('Failed to update'),
  })

  const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin', ADMIN: 'Administrator', MANAGER: 'Manager', OPERATOR: 'Operator', VIEWER: 'Viewer',
  }

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden">
      <div className="h-24 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500" />
      <CardContent className="pb-5 px-5">
        <div className="flex items-end justify-between -mt-10 mb-4">
          <div className="ring-4 ring-background rounded-full">
            <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size="xl" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(e => !e)} className="mb-1">
            {editing ? <><Save className="mr-1.5 h-3.5 w-3.5" />Cancel</> : <><Edit2 className="mr-1.5 h-3.5 w-3.5" />Edit Profile</>}
          </Button>
        </div>
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label className="text-xs">Full Name</Label><Input value={form.name} onChange={set('name')} className="h-8" /></div>
              <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={set('phone')} className="h-8" /></div>
              <div className="space-y-1"><Label className="text-xs">Address</Label><Input value={form.address} onChange={set('address')} className="h-8" /></div>
              <div className="col-span-2 space-y-1"><Label className="text-xs">Bio</Label><Textarea value={form.bio} onChange={set('bio')} rows={2} className="resize-none text-sm" /></div>
              <div className="col-span-2 space-y-1"><Label className="text-xs">Avatar URL</Label><Input value={form.avatarUrl} onChange={set('avatarUrl')} className="h-8" placeholder="https://…" /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save Changes'}</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <h2 className="text-xl font-bold">{profile.name ?? 'Unnamed User'}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-xs">{ROLE_LABELS[profile.role] ?? profile.role}</Badge>
                {profile.branch && <span className="text-xs text-muted-foreground">· {profile.branch.name}</span>}
              </div>
            </div>
            {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{profile.email}</span>
              {profile.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{profile.phone}</span>}
              {profile.address && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{profile.address}</span>}
            </div>
            <p className="text-xs text-muted-foreground pt-0.5">
              Member since {formatDate(profile.createdAt)}
              {profile.lastLoginAt && <> · Last active {formatDate(profile.lastLoginAt)}</>}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Personal dashboard ────────────────────────────────────────────────────────
const MODULE_LINKS: Array<{ module: string; label: string; href: string; color: string }> = [
  { module: 'pos',         label: 'Point of Sale', href: '/pos',         color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { module: 'crm',         label: 'CRM',           href: '/crm',         color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { module: 'customers',   label: 'Customers',     href: '/customers',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { module: 'sales',       label: 'Sales',         href: '/sales',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { module: 'procurement', label: 'Procurement',   href: '/procurement', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { module: 'inventory',   label: 'Inventory',     href: '/inventory',   color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { module: 'finance',     label: 'Finance',       href: '/finance',     color: 'bg-green-100 text-green-700 border-green-200' },
  { module: 'hr',          label: 'HR',            href: '/hr',          color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { module: 'expenses',    label: 'Expenses',      href: '/expenses',    color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { module: 'projects',    label: 'Projects',      href: '/projects',    color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { module: 'documents',   label: 'Documents',     href: '/documents',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { module: 'workflow',    label: 'Approvals',     href: '/workflow',    color: 'bg-lime-100 text-lime-700 border-lime-200' },
  { module: 'reports',     label: 'Reports',       href: '/reports',     color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { module: 'settings',    label: 'Settings',      href: '/settings',    color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { module: 'audit',       label: 'Audit Trail',   href: '/audit',       color: 'bg-red-100 text-red-700 border-red-200' },
]

function PersonalDashboard({ profile, allowedModules }: { profile: UserProfile; allowedModules: string[] | null }) {
  const visibleLinks = MODULE_LINKS.filter(l => allowedModules != null ? allowedModules.includes(l.module) : true)
  return (
    <div className="space-y-6">
      <ProfileCard profile={profile} />
      <div className="rounded-xl border border-border/60 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Welcome back, {profile.name?.split(' ')[0] ?? 'there'} 👋</h2>
        <p className="mt-1 text-sm text-muted-foreground">Here are the modules you have access to. Click any tile to get started.</p>
      </div>
      {visibleLinks.length > 0 ? (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Modules</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleLinks.map(l => (
              <Link key={l.href} href={l.href}>
                <div className={cn('flex items-center gap-3 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all', l.color)}>
                  <span className="text-sm font-semibold">{l.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
          <ShieldOff className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No modules assigned yet. Contact your administrator.</p>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const qc = useQueryClient()
  const currentYear = new Date().getFullYear()
  const [liveKpis, setLiveKpis] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/events/stream')
    es.addEventListener('snapshot', (e) => {
      try { setLiveKpis(JSON.parse(e.data)) } catch { /* ignore */ }
    })
    es.addEventListener('update', (e) => {
      try { setLiveKpis(JSON.parse(e.data)); qc.invalidateQueries({ queryKey: ['dashboard'] }) } catch { /* ignore */ }
    })
    es.onerror = () => es.close()
    return () => es.close()
  }, [qc])

  useEffect(() => {
    const prefetch = (href: string) => {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = href
      document.head.appendChild(link)
    }
    prefetch('/dashboard')
    prefetch('/sales/orders')
    prefetch('/customers')
    prefetch('/inventory/items')
    prefetch('/pos')
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const r = await api.get<DashboardData>('/api/dashboard/init')
      if (!r.success || !r.data) throw new Error(r.error ?? 'Failed to load dashboard')
      return r.data
    },
    staleTime: 120_000,
    refetchInterval: 120_000,
    placeholderData: (prev) => prev,
  })

  const { data: retailKpis } = useQuery({
    queryKey: ['retail-dashboard'],
    queryFn: async () => {
      const r = await api.get<RetailKpis>('/api/retail/dashboard')
      if (!r.success || !r.data) throw new Error(r.error ?? 'Failed to load retail KPI')
      return r.data
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  })

  const { data: yearlyData = [] } = useQuery({
    queryKey: ['yearly-report', currentYear],
    queryFn: () => api.get<YearlyMonth[]>(`/api/reports?report=pos-pl&year=${currentYear}`).then(r => r.data ?? []),
    staleTime: 300_000,
    placeholderData: (prev) => prev,
  })

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const r = await api.get<UserProfile>('/api/users/me')
      if (!r.success || !r.data) throw new Error(r.error ?? 'Failed to load profile')
      return r.data
    },
    staleTime: 60_000,
  })

  if (!profileLoading && profile && !profile.onboardingDone) {
    return <OnboardingForm onDone={() => {}} />
  }

  const allowedModules = (session?.user as { allowedModules?: string[] | null } | undefined)?.allowedModules ?? null
  const role = session?.user?.role as Role | undefined
  const hasExecutiveDashboard = allowedModules != null
    ? allowedModules.includes('dashboard')
    : role != null
      ? (ROLE_PERMISSIONS[role]?.includes('*') || ROLE_PERMISSIONS[role]?.includes('dashboard')) ?? false
      : false

  if (!profileLoading && profile && !hasExecutiveDashboard) {
    return <PersonalDashboard profile={profile} allowedModules={allowedModules} />
  }

  if (error) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-200 dark:border-red-900">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-sm font-medium text-red-600 dark:text-red-400">Failed to load dashboard data</p>
        <p className="text-xs text-muted-foreground/60">{(error as Error)?.message}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton-shimmer h-32 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[...Array(10)].map((_, i) => <div key={i} className="skeleton-shimmer h-24 rounded-xl border border-border/50" />)}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="skeleton-shimmer h-64 rounded-xl lg:col-span-2" />
          <div className="skeleton-shimmer h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  const d = data
  const kpis = d?.kpis
  const revenueToday = liveKpis?.revenueToday ?? kpis?.revenueToday ?? 0
  const revenueMTD = liveKpis?.revenueMTD ?? kpis?.revenueMTDFromPayments ?? 0
  const healthScore = computeHealthScore(kpis, d?.arAging)

  const arAgingData = d ? [
    { name: 'Current', value: d.arAging.current, color: CHART_COLORS.emerald },
    { name: '1–30 days', value: d.arAging.days30, color: CHART_COLORS.amber },
    { name: '31–60 days', value: d.arAging.days60, color: CHART_COLORS.red },
    { name: '90+ days', value: d.arAging.days90plus, color: '#7f1d1d' },
  ].filter(x => x.value > 0) : []

  const yearlyTotals = {
    revenue: yearlyData.reduce((s, m) => s + m.revenue, 0),
    expenses: yearlyData.reduce((s, m) => s + m.expenses, 0),
    profit: yearlyData.reduce((s, m) => s + m.profit, 0),
  }

  const { salutation, first } = getGreeting(profile?.name ?? session?.user?.name)

  const salesStages = [
    { label: 'Quotation', done: true },
    { label: 'Order', active: true, count: kpis?.openSalesOrders ?? 0 },
    { label: 'Delivery', count: undefined },
    { label: 'Invoice', count: undefined },
    { label: 'Payment', done: false },
  ]

  const procurementStages = [
    { label: 'PR', done: true },
    { label: 'PO', active: true, count: kpis?.openPOs ?? 0 },
    { label: 'Receipt', count: undefined },
    { label: 'Invoice', count: undefined },
    { label: 'Payment', done: false },
  ]

  return (
    <div className="space-y-6">

      {/* ── Greeting Banner ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 p-6 shadow-xl shadow-indigo-900/10 ring-1 ring-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.10),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-200">{formatFullDate()}</p>
            <h1 className="mt-1 text-[28px] font-bold tracking-tight text-white">{salutation}, {first}</h1>
            <p className="mt-1 text-sm text-indigo-200/90">Here&apos;s your business overview for today</p>
            {liveKpis && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-xs font-medium text-emerald-200">Live data — updates in real time</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <HealthScore score={healthScore} />
            </div>
            <div className="hidden rounded-xl border border-white/10 bg-white/10 px-5 py-3 backdrop-blur-sm lg:flex lg:flex-col lg:items-end lg:gap-0.5">
              <span className="text-2xl font-bold tracking-tight text-white">{formatGBP(revenueMTD)}</span>
              <span className="text-xs text-indigo-200">Revenue This Month</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Financial KPIs ──────────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={Banknote}>Financial Overview</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { title: 'Revenue Today', value: formatGBP(revenueToday), sub: 'Payments received', icon: TrendingUp, accent: 'bg-emerald-500', onClick: () => router.push('/finance') },
            { title: 'Revenue MTD', value: formatGBP(revenueMTD), sub: 'Month-to-date', icon: BarChart2, accent: 'bg-blue-500', onClick: () => router.push('/finance') },
            { title: 'Cash Position', value: formatGBP(kpis?.cashPosition ?? 0), sub: `${d?.bankAccounts.length ?? 0} bank account(s)`, icon: Building2, accent: 'bg-teal-500', onClick: () => router.push('/finance/bank-accounts') },
            { title: 'AR Outstanding', value: formatGBP(kpis?.arOutstanding ?? 0), sub: (d?.arAging.days90plus ?? 0) > 0 ? '90+ days overdue!' : 'Unpaid invoices', icon: CreditCard, accent: 'bg-amber-500', urgent: (d?.arAging.days90plus ?? 0) > 0, onClick: () => router.push('/sales/invoices') },
            { title: 'AP Due This Week', value: formatGBP(kpis?.apDueThisWeek ?? 0), sub: 'Vendor payments due ≤7 days', icon: Banknote, accent: 'bg-orange-500', urgent: (kpis?.apDueThisWeek ?? 0) > 0 },
          ].map((c, i) => <KpiCard key={c.title} {...c} delay={i * 40} />)}
        </div>
      </div>

      {/* ── Operations KPIs ─────────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={Activity}>Operations</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { title: 'Open Sales Orders', value: String(kpis?.openSalesOrders ?? 0), sub: 'Active orders', icon: ShoppingCart, accent: 'bg-indigo-500', onClick: () => router.push('/sales/orders') },
            { title: 'Open POs', value: String(kpis?.openPOs ?? 0), sub: 'Purchase orders', icon: Package, accent: 'bg-cyan-500', onClick: () => router.push('/procurement/purchase-orders') },
            { title: 'Pending Approvals', value: String(kpis?.pendingApprovals ?? 0), sub: 'Awaiting review', icon: Workflow, accent: 'bg-violet-500', urgent: (kpis?.pendingApprovals ?? 0) > 0, onClick: () => router.push('/workflow') },
            { title: 'Low Stock', value: String(kpis?.lowStockAlerts ?? 0), sub: 'Below reorder point', icon: AlertTriangle, accent: 'bg-red-500', urgent: (kpis?.lowStockAlerts ?? 0) > 0, onClick: () => router.push('/inventory/items') },
            { title: 'Leave Requests', value: String(kpis?.pendingLeaves ?? 0), sub: 'Awaiting approval', icon: Clock, accent: 'bg-pink-500', onClick: () => router.push('/hr/attendance') },
          ].map((c, i) => <KpiCard key={c.title} {...c} delay={i * 40} />)}
        </div>
      </div>

      {/* ── Hero Charts Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Revenue & Profit trend */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-1 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Revenue &amp; Profit Trend</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{currentYear} — Monthly performance</p>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />Revenue</div>
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Profit</div>
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" />Expenses</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {yearlyData.length === 0 ? (
              <div className="flex h-52 items-center justify-center">
                <p className="text-xs text-muted-foreground">No P&amp;L data for {currentYear}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={yearlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.12} />
                      <stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${getAppCurrencySymbol()}${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS.blue} strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="profit" name="Profit" stroke={CHART_COLORS.emerald} strokeWidth={2} fill="url(#profGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="expenses" name="Expenses" stroke={CHART_COLORS.red} strokeWidth={1.5} strokeDasharray="4 2" dot={false} activeDot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
            {/* Annual summary */}
            <div className="mt-1 grid grid-cols-3 gap-2 px-2">
              {[
                { label: 'Total Revenue', value: formatGBP(yearlyTotals.revenue), color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
                { label: 'Total Expenses', value: formatGBP(yearlyTotals.expenses), color: 'text-red-700', bg: 'bg-red-50 border-red-100' },
                { label: 'Net Profit', value: formatGBP(yearlyTotals.profit), color: yearlyTotals.profit >= 0 ? 'text-emerald-700' : 'text-red-700', bg: yearlyTotals.profit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100' },
              ].map(item => (
                <div key={item.label} className={cn('rounded-lg border px-3 py-2', item.bg)}>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className={cn('text-sm font-bold mt-0.5', item.color)}>{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Center */}
        <div className="flex flex-col gap-4">
          {/* Pending Approvals */}
          <Card className="border-border/60 shadow-sm flex-1">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Workflow className="h-3.5 w-3.5 text-violet-500" />
                Pending Approvals
                {(d?.pendingWorkflow.length ?? 0) > 0 && (
                  <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-100 px-1 text-[10px] font-bold text-violet-700">
                    {d?.pendingWorkflow.length}
                  </span>
                )}
              </CardTitle>
              {(d?.pendingWorkflow.length ?? 0) > 0 && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => router.push('/workflow')}>
                  View all <ChevronRight className="ml-0.5 h-3 w-3" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {(d?.pendingWorkflow ?? []).length === 0 ? (
                <div className="flex h-20 flex-col items-center justify-center gap-2">
                  <div className="rounded-full bg-emerald-50 p-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="text-xs text-muted-foreground">All caught up!</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {d?.pendingWorkflow.slice(0, 4).map(w => (
                    <div key={w.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{w.workflow}</p>
                        <p className="text-[10px] text-muted-foreground">{w.requester}</p>
                      </div>
                      <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', MODULE_COLORS[w.module] ?? 'bg-gray-100 text-gray-600')}>
                        {w.module}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Tasks */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-3 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                My Tasks
                {(d?.myTasks.length ?? 0) > 0 && (
                  <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-100 px-1 text-[10px] font-bold text-emerald-700">
                    {d?.myTasks.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {(d?.myTasks ?? []).length === 0 ? (
                <div className="flex items-center gap-2 py-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs text-muted-foreground">Nothing assigned to you right now</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {d?.myTasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{t.workflow}</p>
                        <p className="text-[10px] text-muted-foreground">{t.requester}</p>
                      </div>
                      <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', MODULE_COLORS[t.module] ?? 'bg-gray-100 text-gray-600')}>
                        {t.module}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workflow Alerts (Approval / Financial / Inventory) */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-3 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-amber-500" />
                Workflow Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              {[
                { key: 'approvals', label: 'Approvals', items: d?.workflowAlerts.approvals ?? [] },
                { key: 'financial', label: 'Financial', items: d?.workflowAlerts.financial ?? [] },
                { key: 'inventory', label: 'Inventory', items: d?.workflowAlerts.inventory ?? [] },
              ].every(g => g.items.length === 0) ? (
                <div className="flex items-center gap-2 py-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs text-muted-foreground">No urgent alerts</p>
                </div>
              ) : (
                [
                  { key: 'approvals', label: 'Approvals', items: d?.workflowAlerts.approvals ?? [] },
                  { key: 'financial', label: 'Financial', items: d?.workflowAlerts.financial ?? [] },
                  { key: 'inventory', label: 'Inventory', items: d?.workflowAlerts.inventory ?? [] },
                ].filter(g => g.items.length > 0).map(g => (
                  <div key={g.key}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">{g.label}</p>
                    <div className="space-y-1.5">
                      {g.items.map((a) => (
                        <Link key={a.label} href={a.href}>
                          <div className="flex items-start gap-2 rounded-lg px-2.5 py-2 text-xs cursor-pointer hover:opacity-80 transition-opacity bg-amber-50 border border-amber-100 text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>{a.count} {a.label}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <SectionLabel>Quick Actions</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'New Customer', href: '/sales/customers' },
            { label: 'New Supplier', href: '/procurement/vendors' },
            { label: 'New Quotation', href: '/sales/quotations/new' },
            { label: 'New PO', href: '/procurement/purchase-orders/new' },
            { label: 'New Invoice', href: '/sales/invoices/new' },
            { label: 'New Employee', href: '/hr' },
          ].map(a => (
            <Link key={a.label} href={a.href}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-border/60 bg-white px-3.5 text-xs font-medium text-foreground/80 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md">
              <span className="text-indigo-500">+</span> {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Analysis Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Top Customers */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-blue-500" />
              Top Customers — MTD
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => router.push('/sales/invoices')}>
              View <ChevronRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.topCustomers ?? []).length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <p className="text-xs text-muted-foreground">No customer data this month</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {d?.topCustomers.map((c, i) => {
                  const maxTotal = d.topCustomers[0]?.total ?? 1
                  const pct = Math.round((c.total / maxTotal) * 100)
                  return (
                    <div key={c.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-bold text-muted-foreground/50 w-3">{i + 1}</span>
                          <span className="text-xs truncate max-w-[110px]">{c.name}</span>
                        </div>
                        <span className="text-xs font-semibold shrink-0">{formatGBP(c.total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AR Aging */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-1 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">AR Ageing</CardTitle>
            {(d?.arAging.days90plus ?? 0) > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                <AlertTriangle className="h-2.5 w-2.5" /> Overdue
              </span>
            )}
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {arAgingData.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2">
                <div className="rounded-full bg-emerald-50 p-3">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">All invoices current</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={arAgingData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {arAgingData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => formatGBP(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {arAgingData.map(row => (
                    <div key={row.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: row.color }} />
                        <span className="text-muted-foreground">{row.name}</span>
                      </div>
                      <span className="font-semibold">{formatGBP(row.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-amber-500" />
              Recent Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.recentNotifications ?? []).length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <p className="text-xs text-muted-foreground">No recent notifications</p>
              </div>
            ) : (
              <div className="space-y-2">
                {d?.recentNotifications.map(n => (
                  <div key={n.id} className={cn('flex gap-2.5 rounded-lg border border-border/40 px-3 py-2', !n.isRead ? 'bg-blue-50/50' : 'bg-muted/10 opacity-70')}>
                    <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', NOTIF_COLORS[n.type] ?? 'bg-gray-400')} />
                    <div className="min-w-0">
                      <p className={cn('text-xs truncate', !n.isRead && 'font-semibold')}>{n.title}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{n.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Workflow Center ──────────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={Workflow}>Workflow Center</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <WorkflowPipeline
            title="Sales Pipeline"
            icon={Receipt}
            color="text-emerald-500"
            stages={salesStages}
          />
          <WorkflowPipeline
            title="Procurement Pipeline"
            icon={Truck}
            color="text-teal-500"
            stages={procurementStages}
          />
        </div>
      </div>

      {/* ── Bank Accounts + Low Stock + Activity ──────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Bank Accounts */}
        {(d?.bankAccounts ?? []).length > 0 && (
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-teal-500" />
                Bank Accounts
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => router.push('/finance/bank-accounts')}>
                Manage
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="space-y-2">
                {d?.bankAccounts.map(acc => (
                  <div key={acc.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-50">
                        <Building2 className="h-3.5 w-3.5 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-xs font-medium">{acc.accountName}</p>
                        <p className="text-[10px] text-muted-foreground">{acc.accountType}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold">{formatCurrency(acc.currentBalance, acc.currency)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Low Stock */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              Low Stock Alerts
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => router.push('/inventory/items')}>
              View items
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.lowStockItems ?? []).length === 0 ? (
              <div className="flex h-28 flex-col items-center justify-center gap-2">
                <div className="rounded-full bg-emerald-50 p-2.5">
                  <Package className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-xs text-muted-foreground">All stock levels healthy</p>
              </div>
            ) : (
              <div className="space-y-2">
                {d?.lowStockItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/60 px-3 py-2">
                    <div>
                      <p className="text-xs font-medium">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">SKU: {item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-red-600">{item.currentStock} left</p>
                      <p className="text-[10px] text-muted-foreground">Reorder @ {item.reorderPoint}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-blue-500" />
              Recent Activity
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => router.push('/sales/invoices')}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-2">
            {(d?.recentActivity ?? []).length === 0 ? (
              <div className="flex h-28 items-center justify-center">
                <p className="text-xs text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {d?.recentActivity.map(activity => (
                  <div key={activity.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{activity.description}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(activity.date)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs font-bold">{formatGBP(activity.amount)}</span>
                      <Badge
                        variant={activity.status === 'PAID' ? 'success' : activity.status === 'OVERDUE' ? 'destructive' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {activity.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── UK Retail KPIs ───────────────────────────────────────────────── */}
      {retailKpis && (
        <section>
          <SectionLabel icon={Leaf}>UK Retail — POS Revenue &amp; Expense</SectionLabel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[
              {
                label: 'Today Sales', value: formatGBP(retailKpis.todaySales),
                sub: `${retailKpis.salesVariancePct >= 0 ? '+' : ''}${retailKpis.salesVariancePct.toFixed(1)}% vs LY`,
                urgent: false, accent: 'bg-emerald-500',
              },
              { label: 'Revenue MTD', value: formatGBP(retailKpis.mtdNetSales), sub: 'Net of VAT', urgent: false, accent: 'bg-sky-500' },
              { label: 'COGS MTD', value: formatGBP(retailKpis.mtdCogs), sub: 'Cost of goods sold', urgent: false, accent: 'bg-rose-500' },
              {
                label: 'Gross Profit MTD', value: formatGBP(retailKpis.grossProfitMtd),
                sub: `${retailKpis.grossProfitMtdPct.toFixed(1)}% margin`,
                urgent: retailKpis.grossProfitMtd < 0, accent: 'bg-blue-500',
              },
              { label: 'Basket Size', value: formatGBP(retailKpis.avgTransactionValue), sub: `${retailKpis.todayTransactionCount} transactions`, urgent: false, accent: 'bg-teal-500' },
              { label: 'Wage Cost %', value: `${retailKpis.wageCostRatio.toFixed(1)}%`, sub: 'Wages / Sales', urgent: retailKpis.wageCostRatio > 30, accent: 'bg-violet-500' },
              { label: 'Waste', value: formatGBP(retailKpis.wasteValueToday), sub: 'Expired stock', urgent: retailKpis.wasteValueToday > 0, accent: 'bg-orange-500' },
              { label: 'Expiry Alerts', value: String(retailKpis.expiryAlerts7Day), sub: 'Expiring in 7 days', urgent: retailKpis.expiryAlerts7Day > 0, accent: 'bg-amber-500' },
            ].map((item, i) => (
              <KpiCard key={item.label} title={item.label} value={item.value} sub={item.sub}
                icon={Leaf} accent={item.accent} urgent={item.urgent} delay={i * 40} />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
