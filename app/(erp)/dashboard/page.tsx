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
import { Badge } from '@/components/ui/badge'
import dynamic from 'next/dynamic'

const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false })
const ComposedChart = dynamic(() => import('recharts').then(m => m.ComposedChart), { ssr: false })
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false })
import {
  ShoppingCart, AlertTriangle, TrendingUp,
  Package, BarChart2, ArrowRight, Bell, CheckCircle, Workflow,
  CreditCard, Users, Building2, ArrowUpRight, ArrowDownRight,
  Activity, User, Mail, Phone, MapPin, Edit2, Save, ShieldOff,
  Leaf, ChevronRight, Truck, Receipt, DollarSign, TrendingDown,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const CHART_COLORS = {
  blue: '#3B82F6', emerald: '#22C55E', amber: '#F59E0B',
  red: '#EF4444', violet: '#8B5CF6', teal: '#06B6D4', indigo: '#6366F1',
  gray: '#94A3B8', pink: '#EC4899', orange: '#F97316', cyan: '#14B8A6',
}

const NOTIF_COLORS: Record<string, string> = {
  SUCCESS: '#22C55E', ERROR: '#EF4444', WARNING: '#F59E0B',
  INFO: '#3B82F6', REMINDER: '#8B5CF6',
}

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

function KpiCard({
  title, value, sub, icon: Icon, trend, urgent, onClick, delay = 0,
}: {
  title: string; value: string; sub?: string; icon: React.ElementType
  trend?: 'up' | 'down'; urgent?: boolean; onClick?: () => void; delay?: number
}) {
  return (
    <div
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        'group relative overflow-hidden rounded-2xl soft-card soft-card-hover p-5',
        urgent ? 'ring-1 ring-red-200' : '',
        onClick && 'cursor-pointer select-none',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}</p>
          <p className={cn('mt-1.5 text-2xl font-bold leading-none tracking-tight text-slate-800', urgent && 'text-red-500')}>{value}</p>
          {sub && (
            <div className="mt-2 flex items-center gap-1">
              {trend === 'up' && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
              {trend === 'down' && <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-red-500" />}
              <span className={cn('text-[11px] font-medium', trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-slate-400')}>{sub}</span>
            </div>
          )}
        </div>
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110',
          urgent ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-[#3B82F6]',
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {onClick && <ArrowRight className="absolute bottom-4 right-4 h-3.5 w-3.5 text-slate-300 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />}
    </div>
  )
}

function SectionLabel({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {Icon && <Icon className="h-4 w-4 text-[#3B82F6]" />}
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">{children}</h2>
      <div className="h-px flex-1 bg-slate-200/80" />
    </div>
  )
}

function HealthScore({ score }: { score: number }) {
  const r = 18
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#22C55E' : score >= 60 ? '#F59E0B' : '#EF4444'
  const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Fair' : 'Needs Attention'
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-12 w-12">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={r} fill="none" stroke="#E2E8F0" strokeWidth="4" />
          <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-slate-800">{score}</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-800">{label}</p>
        <p className="text-[10px] text-slate-400">Business Health</p>
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl soft-card shadow-soft-lg px-3 py-2 text-xs">
      {label && <p className="font-semibold text-slate-800 mb-1">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-800">{formatGBP(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function WorkflowPipeline({
  title, stages, icon: Icon,
}: {
  title: string
  stages: Array<{ label: string; count?: number; done?: boolean; active?: boolean }>
  icon: React.ElementType
}) {
  return (
    <div className="soft-card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-[#3B82F6]" />
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex items-center min-w-0">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all',
                stage.done
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : stage.active
                    ? 'bg-[#3B82F6] border-[#3B82F6] text-white ring-4 ring-blue-100'
                    : 'bg-slate-50 border-slate-200 text-slate-400',
              )}>
                {stage.done ? <CheckCircle className="h-4 w-4" /> : stage.count != null ? stage.count : i + 1}
              </div>
              <span className={cn(
                'text-[10px] font-medium text-center leading-tight whitespace-nowrap',
                stage.active ? 'text-[#3B82F6]' : stage.done ? 'text-emerald-600' : 'text-slate-400',
              )}>{stage.label}</span>
            </div>
            {i < stages.length - 1 && (
              <div className={cn('mx-1 h-0.5 w-8 shrink-0', stage.done ? 'bg-emerald-200' : 'bg-slate-200')} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Avatar({ name, avatarUrl, size = 'md' }: { name?: string | null; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' }
  const initials = (name ?? 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  if (avatarUrl) return <img src={avatarUrl} alt={name ?? ''} className={cn('rounded-full object-cover ring-2 ring-border shadow-lg', sizes[size])} />
  return (
    <div className={cn('rounded-full bg-[#007AFF] flex items-center justify-center font-bold text-foreground ring-2 ring-border shadow-lg', sizes[size])}>
      {initials}
    </div>
  )
}

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
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#007AFF]/15">
            <User className="h-8 w-8 text-[#007AFF]" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Welcome! Let&apos;s set up your profile</h1>
          <p className="text-muted-foreground text-sm">Fill in your details so teammates know who you are.</p>
        </div>
        <div className="soft-card rounded-2xl p-6">
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/50">
              <Avatar name={form.name || 'You'} avatarUrl={form.avatarUrl || null} size="lg" />
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Profile Picture URL (optional)</Label>
                <Input placeholder="https://example.com/photo.jpg" value={form.avatarUrl} onChange={set('avatarUrl')} className="h-8 text-sm rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-sm font-medium text-foreground/80">Full Name *</Label>
                <Input placeholder="Jane Smith" value={form.name} onChange={set('name')} className="rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground/80">Phone Number</Label>
                <Input placeholder="+44 7700 900123" value={form.phone} onChange={set('phone')} className="rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground/80">Address</Label>
                <Input placeholder="London, UK" value={form.address} onChange={set('address')} className="rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-sm font-medium text-foreground/80">Short Bio</Label>
                <Textarea placeholder="Tell your team a bit about yourself…" value={form.bio} onChange={set('bio')} rows={2} className="resize-none rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
              </div>
            </div>
            <button
              onClick={() => save.mutate()}
              disabled={!form.name.trim() || save.isPending}
              className="w-full h-10 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] text-foreground text-sm font-semibold transition-all duration-200 disabled:opacity-50 shadow-lg shadow-blue-500/20 active:scale-[0.98]"
            >
              {save.isPending ? 'Saving…' : 'Complete Setup & Go to Dashboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
    <div className="soft-card rounded-2xl overflow-hidden">
      <div className="h-20 bg-gradient-to-r from-[#007AFF] to-[#5856D6]" />
      <div className="pb-5 px-5">
        <div className="flex items-end justify-between -mt-10 mb-4">
          <div className="ring-4 ring-background rounded-full">
            <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size="xl" />
          </div>
          <button
            onClick={() => setEditing(e => !e)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-600 hover:text-slate-800 transition-all mb-1"
          >
            {editing ? <><Save className="mr-1.5 h-3.5 w-3.5" />Cancel</> : <><Edit2 className="mr-1.5 h-3.5 w-3.5" />Edit Profile</>}
          </button>
        </div>
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label className="text-xs text-muted-foreground">Full Name</Label><Input value={form.name} onChange={set('name')} className="h-8 rounded-xl bg-background border-border text-foreground" /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Phone</Label><Input value={form.phone} onChange={set('phone')} className="h-8 rounded-xl bg-background border-border text-foreground" /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Address</Label><Input value={form.address} onChange={set('address')} className="h-8 rounded-xl bg-background border-border text-foreground" /></div>
              <div className="col-span-2 space-y-1"><Label className="text-xs text-muted-foreground">Bio</Label><Textarea value={form.bio} onChange={set('bio')} rows={2} className="resize-none text-sm rounded-xl bg-background border-border text-foreground" /></div>
              <div className="col-span-2 space-y-1"><Label className="text-xs text-muted-foreground">Avatar URL</Label><Input value={form.avatarUrl} onChange={set('avatarUrl')} className="h-8 rounded-xl bg-background border-border text-foreground" placeholder="https://…" /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => save.mutate()} disabled={save.isPending} className="h-8 px-4 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] text-foreground text-xs font-semibold transition-all disabled:opacity-50">{save.isPending ? 'Saving…' : 'Save Changes'}</button>
              <button onClick={() => setEditing(false)} className="h-8 px-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-600 hover:text-slate-800 transition-all">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <h2 className="text-xl font-bold text-foreground">{profile.name ?? 'Unnamed User'}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-xs rounded-md bg-accent text-muted-foreground border-0">{ROLE_LABELS[profile.role] ?? profile.role}</Badge>
                {profile.branch && <span className="text-xs text-muted-foreground">· {profile.branch.name}</span>}
              </div>
            </div>
            {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{profile.email}</span>
              {profile.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{profile.phone}</span>}
              {profile.address && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{profile.address}</span>}
            </div>
            <p className="text-xs text-muted-foreground/70 pt-0.5">
              Member since {formatDate(profile.createdAt)}
              {profile.lastLoginAt && <> · Last active {formatDate(profile.lastLoginAt)}</>}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

const MODULE_LINKS: Array<{ module: string; label: string; href: string; color: string }> = [
  { module: 'pos',         label: 'Point of Sale', href: '/pos',         color: 'bg-[#007AFF]/15 text-[#007AFF]' },
  { module: 'crm',         label: 'CRM',           href: '/crm',         color: 'bg-[#BF5AF2]/15 text-[#BF5AF2]' },
  { module: 'customers',   label: 'Customers',     href: '/customers',   color: 'bg-[#007AFF]/15 text-[#007AFF]' },
  { module: 'sales',       label: 'Sales',         href: '/sales',       color: 'bg-[#34C759]/15 text-[#34C759]' },
  { module: 'procurement', label: 'Procurement',   href: '/procurement', color: 'bg-[#5AC8FA]/15 text-[#5AC8FA]' },
  { module: 'inventory',   label: 'Inventory',     href: '/inventory',   color: 'bg-[#FF9F0A]/15 text-[#FF9F0A]' },
  { module: 'finance',     label: 'Finance',       href: '/finance',     color: 'bg-[#34C759]/15 text-[#34C759]' },
  { module: 'hr',          label: 'HR',            href: '/hr',          color: 'bg-[#FF453A]/15 text-[#FF453A]' },
  { module: 'expenses',    label: 'Expenses',      href: '/expenses',    color: 'bg-[#FF453A]/15 text-[#FF453A]' },
  { module: 'projects',    label: 'Projects',      href: '/projects',    color: 'bg-[#5AC8FA]/15 text-[#5AC8FA]' },
  { module: 'documents',   label: 'Documents',     href: '/documents',   color: 'bg-[#FF9F0A]/15 text-[#FF9F0A]' },
  { module: 'workflow',    label: 'Approvals',     href: '/workflow',    color: 'bg-[#34C759]/15 text-[#34C759]' },
  { module: 'reports',     label: 'Reports',       href: '/reports',     color: 'bg-[#BF5AF2]/15 text-[#BF5AF2]' },
  { module: 'settings',    label: 'Settings',      href: '/settings',    color: 'bg-[#8E8E93]/15 text-[#8E8E93]' },
  { module: 'audit',       label: 'Audit Trail',   href: '/audit',       color: 'bg-[#FF453A]/15 text-[#FF453A]' },
]

function PersonalDashboard({ profile, allowedModules }: { profile: UserProfile; allowedModules: string[] | null }) {
  const visibleLinks = MODULE_LINKS.filter(l => allowedModules != null ? allowedModules.includes(l.module) : true)
  return (
    <div className="space-y-8">
      <ProfileCard profile={profile} />
      <div className="soft-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-foreground">Welcome back, {profile.name?.split(' ')[0] ?? 'there'}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Here are the modules you have access to. Click any tile to get started.</p>
      </div>
      {visibleLinks.length > 0 ? (
        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Modules</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleLinks.map(l => (
              <Link key={l.href} href={l.href}>
                <div className={cn('flex items-center gap-3 rounded-2xl px-4 py-3 cursor-pointer soft-card soft-card-hover transition-all', l.color)}>
                  <span className="text-sm font-semibold">{l.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 py-12 text-center soft-card">
          <ShieldOff className="h-8 w-8 text-muted-foreground/70" />
          <p className="text-sm text-muted-foreground">No modules assigned yet. Contact your administrator.</p>
        </div>
      )}
    </div>
  )
}

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
    queryFn: () => api.get<YearlyMonth[]>(`/api/reports?type=yearly-expenses&year=${currentYear}`).then(r => r.data ?? []),
    staleTime: 300_000,
    placeholderData: (prev) => prev ?? [],
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
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-red-200 soft-card">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <p className="text-sm font-medium text-red-500">Failed to load dashboard data</p>
        <p className="text-xs text-slate-400">{(error as Error)?.message}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton-shimmer h-28 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton-shimmer h-24 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="skeleton-shimmer h-64 rounded-2xl lg:col-span-2" />
          <div className="skeleton-shimmer h-64 rounded-2xl" />
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
    { name: '90+ days', value: d.arAging.days90plus, color: '#8B0000' },
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
    { label: 'Delivery' },
    { label: 'Invoice' },
    { label: 'Payment' },
  ]

  const procurementStages = [
    { label: 'PR', done: true },
    { label: 'PO', active: true, count: kpis?.openPOs ?? 0 },
    { label: 'Receipt' },
    { label: 'Invoice' },
    { label: 'Payment' },
  ]

  return (
    <div className="space-y-10">

      <div className="animate-slide-up">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-slate-400 font-medium">{formatFullDate()}</p>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight text-slate-800">{salutation}, {first}</h1>
              <p className="mt-1 text-sm text-slate-500">Here&apos;s your business overview for today</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="soft-card rounded-2xl px-4 py-3">
                <HealthScore score={healthScore} />
              </div>
              <div className="hidden soft-card rounded-2xl px-5 py-3 lg:block">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Revenue This Month</p>
                <p className="text-2xl font-bold tracking-tight text-slate-800">{formatGBP(revenueMTD)}</p>
              </div>
            </div>
          </div>
          {liveKpis && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-700">Live data — updates in real time</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionLabel icon={DollarSign}>Revenue</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { title: 'Revenue Today', value: formatGBP(revenueToday), sub: 'Payments received', icon: TrendingUp, onClick: () => router.push('/finance') },
            { title: 'Revenue MTD', value: formatGBP(revenueMTD), sub: 'Month-to-date', icon: BarChart2, onClick: () => router.push('/finance') },
            { title: 'Cash Position', value: formatGBP(kpis?.cashPosition ?? 0), sub: `${d?.bankAccounts.length ?? 0} bank account(s)`, icon: Building2, onClick: () => router.push('/finance/bank-accounts') },
            { title: 'AR Outstanding', value: formatGBP(kpis?.arOutstanding ?? 0), sub: (d?.arAging.days90plus ?? 0) > 0 ? '90+ days overdue' : 'Unpaid invoices', icon: CreditCard, urgent: (d?.arAging.days90plus ?? 0) > 0, onClick: () => router.push('/sales/invoices') },
          ].map((c, i) => <KpiCard key={c.title} {...c} delay={i * 60} />)}
        </div>
      </div>

      <div>
        <SectionLabel icon={Activity}>Operations</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { title: 'Open Sales Orders', value: String(kpis?.openSalesOrders ?? 0), sub: 'Active orders', icon: ShoppingCart, onClick: () => router.push('/sales/orders') },
            { title: 'Open POs', value: String(kpis?.openPOs ?? 0), sub: 'Purchase orders', icon: Package, onClick: () => router.push('/procurement/purchase-orders') },
            { title: 'Pending Approvals', value: String(kpis?.pendingApprovals ?? 0), sub: 'Awaiting review', icon: Workflow, urgent: (kpis?.pendingApprovals ?? 0) > 0, onClick: () => router.push('/workflow') },
            { title: 'Low Stock', value: String(kpis?.lowStockAlerts ?? 0), sub: 'Below reorder point', icon: AlertTriangle, urgent: (kpis?.lowStockAlerts ?? 0) > 0, onClick: () => router.push('/inventory/items') },
          ].map((c, i) => <KpiCard key={c.title} {...c} delay={i * 60} />)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="soft-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Revenue &amp; Profit Trend</h3>
                <p className="text-sm text-slate-400 mt-0.5">{currentYear} — Monthly performance</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />Revenue</div>
                <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Profit</div>
                <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" />Expenses</div>
              </div>
            </div>
            {yearlyData.length === 0 ? (
              <div className="flex h-52 items-center justify-center">
                <p className="text-sm text-slate-400">No P&amp;L data for {currentYear}</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={yearlyData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `${getAppCurrencySymbol()}${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS.blue} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.blue }} />
                    <Line type="monotone" dataKey="profit" name="Profit" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.emerald }} />
                    <Line type="monotone" dataKey="expenses" name="Expenses" stroke={CHART_COLORS.red} strokeWidth={1.5} strokeDasharray="4 2" dot={false} activeDot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Revenue', value: formatGBP(yearlyTotals.revenue), color: 'text-[#3B82F6]', bg: 'bg-blue-50' },
                    { label: 'Total Expenses', value: formatGBP(yearlyTotals.expenses), color: 'text-red-500', bg: 'bg-red-50' },
                    { label: 'Net Profit', value: formatGBP(yearlyTotals.profit), color: yearlyTotals.profit >= 0 ? 'text-emerald-600' : 'text-red-500', bg: yearlyTotals.profit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
                  ].map(item => (
                    <div key={item.label} className={cn('rounded-xl px-4 py-3', item.bg)}>
                      <p className="text-xs text-slate-400 font-medium">{item.label}</p>
                      <p className={cn('text-base font-bold mt-0.5', item.color)}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <WorkflowPipeline title="Sales Pipeline" icon={Receipt} stages={salesStages} />
            <WorkflowPipeline title="Procurement Pipeline" icon={Truck} stages={procurementStages} />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="soft-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Workflow className="h-4 w-4 text-[#3B82F6]" />
                Pending Approvals
                {(d?.pendingWorkflow.length ?? 0) > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-50 px-1.5 text-[10px] font-bold text-[#3B82F6]">
                    {d?.pendingWorkflow.length}
                  </span>
                )}
              </h3>
              {(d?.pendingWorkflow.length ?? 0) > 0 && (
                <button onClick={() => router.push('/workflow')} className="flex items-center gap-1 h-7 px-2 rounded-lg text-xs text-slate-400 hover:text-[#3B82F6] transition-all">
                  View all <ChevronRight className="ml-0.5 h-3 w-3" />
                </button>
              )}
            </div>
            {(d?.pendingWorkflow ?? []).length === 0 ? (
              <div className="flex h-16 flex-col items-center justify-center gap-2">
                <div className="rounded-full bg-emerald-50 p-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-xs text-slate-400">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {d?.pendingWorkflow.slice(0, 4).map(w => (
                  <div key={w.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{w.workflow}</p>
                      <p className="text-xs text-slate-400">{w.requester}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-[#3B82F6]">
                      {w.module}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="soft-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-amber-500" />
              Notifications
            </h3>
            {(d?.recentNotifications ?? []).length === 0 ? (
              <div className="flex h-20 items-center justify-center">
                <p className="text-sm text-slate-400">No recent notifications</p>
              </div>
            ) : (
              <div className="space-y-2">
                {d?.recentNotifications.slice(0, 4).map(n => (
                  <div key={n.id} className={cn('flex gap-3 rounded-xl px-3 py-2.5', !n.isRead ? 'bg-blue-50/60' : 'opacity-60')}>
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: NOTIF_COLORS[n.type] ?? '#CBD5E1' }} />
                    <div className="min-w-0">
                      <p className={cn('text-xs', !n.isRead && 'font-semibold text-slate-800')}>{n.title}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400 truncate">{n.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="soft-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Low Stock
              </h3>
              <button onClick={() => router.push('/inventory/items')} className="h-7 px-2 rounded-lg text-xs text-slate-400 hover:text-[#3B82F6] transition-all">
                View
              </button>
            </div>
            {(d?.lowStockItems ?? []).length === 0 ? (
              <div className="flex h-16 flex-col items-center justify-center gap-2">
                <div className="rounded-full bg-emerald-50 p-2">
                  <Package className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-xs text-slate-400">All stock levels healthy</p>
              </div>
            ) : (
              <div className="space-y-2">
                {d?.lowStockItems.slice(0, 4).map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{item.name}</p>
                      <p className="text-xs text-slate-400">SKU: {item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-500">{item.currentStock} left</p>
                      <p className="text-xs text-slate-400">Reorder @ {item.reorderPoint}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="soft-card rounded-2xl p-5 bg-gradient-to-br from-blue-50/80 to-indigo-50/60">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-500" />
              AI Insights
            </h3>
            <div className="space-y-2 text-xs text-slate-500">
              <p>Revenue is trending {(yearlyData.length > 1 && yearlyData[yearlyData.length - 1]?.revenue > yearlyData[0]?.revenue) ? 'up' : 'stable'} this year. Cash position is {kpis?.cashPosition && kpis.cashPosition > 0 ? 'healthy' : 'low'}.</p>
              <p className="text-slate-400">{(d?.lowStockItems ?? []).length > 0 ? `${(d?.lowStockItems ?? []).length} item(s) below reorder point need attention.` : 'Inventory levels look good.'}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionLabel icon={BarChart2}>Analysis</SectionLabel>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="soft-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Users className="h-4 w-4 text-[#3B82F6]" />
                Top Customers — MTD
              </h3>
              <button onClick={() => router.push('/sales/invoices')} className="flex items-center gap-1 h-7 px-2 rounded-lg text-xs text-slate-400 hover:text-[#3B82F6] transition-all">
                View <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            {(d?.topCustomers ?? []).length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <p className="text-sm text-muted-foreground">No customer data this month</p>
              </div>
            ) : (
              <div className="space-y-3">
                {d?.topCustomers.slice(0, 5).map((c, i) => {
                  const maxTotal = d.topCustomers[0]?.total ?? 1
                  const pct = Math.round((c.total / maxTotal) * 100)
                  return (
                    <div key={c.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground/70 w-4">{i + 1}</span>
                          <span className="text-sm truncate max-w-[120px] text-slate-700">{c.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-800">{formatGBP(c.total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-[#3B82F6] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="soft-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">AR Ageing</h3>
              {(d?.arAging.days90plus ?? 0) > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-medium text-red-500">
                  <AlertTriangle className="h-2.5 w-2.5" /> Overdue
                </span>
              )}
            </div>
            {arAgingData.length === 0 ? (
              <div className="flex h-36 flex-col items-center justify-center gap-2">
                <div className="rounded-full bg-emerald-50 p-3">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-slate-500">All invoices current</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={arAgingData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {arAgingData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => formatGBP(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {arAgingData.map(row => (
                    <div key={row.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                        <span className="text-slate-500">{row.name}</span>
                      </div>
                      <span className="font-semibold text-slate-800">{formatGBP(row.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="soft-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#3B82F6]" />
                Recent Activity
              </h3>
              <button onClick={() => router.push('/sales/invoices')} className="h-7 px-2 rounded-lg text-xs text-slate-400 hover:text-[#3B82F6] transition-all">
                View all
              </button>
            </div>
            {(d?.recentActivity ?? []).length === 0 ? (
              <div className="flex h-28 items-center justify-center">
                <p className="text-sm text-slate-400">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {d?.recentActivity.slice(0, 5).map(activity => (
                  <div key={activity.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{activity.description}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{formatDate(activity.date)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm font-bold text-slate-800">{formatGBP(activity.amount)}</span>
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        activity.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' :
                        activity.status === 'OVERDUE' ? 'bg-red-50 text-red-500' :
                        'bg-slate-100 text-slate-500'
                      )}>
                        {activity.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <SectionLabel icon={TrendingUp}>Quick Actions</SectionLabel>
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
              className="inline-flex h-9 items-center gap-1.5 rounded-full soft-card px-4 text-sm font-medium text-slate-600 soft-card-hover">
              <span className="text-[#3B82F6] font-bold">+</span> {a.label}
            </Link>
          ))}
        </div>
      </div>

      {(d?.bankAccounts ?? []).length > 0 && (
        <div>
          <SectionLabel icon={Building2}>Bank Accounts</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d?.bankAccounts.map(acc => (
              <div key={acc.id} className="soft-card rounded-2xl p-5 soft-card-hover">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                    <Building2 className="h-4 w-4 text-[#3B82F6]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{acc.accountName}</p>
                    <p className="text-xs text-slate-400">{acc.accountType}</p>
                  </div>
                </div>
                <p className="mt-3 text-xl font-bold text-slate-800">{formatCurrency(acc.currentBalance, acc.currency)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {retailKpis && (
        <div>
          <SectionLabel icon={Leaf}>UK Retail — POS Revenue &amp; Expense</SectionLabel>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[
              {
                label: 'Today Sales', value: formatGBP(retailKpis.todaySales),
                sub: `${retailKpis.salesVariancePct >= 0 ? '+' : ''}${retailKpis.salesVariancePct.toFixed(1)}% vs LY`,
                urgent: false,
              },
              { label: 'Revenue MTD', value: formatGBP(retailKpis.mtdNetSales), sub: 'Net of VAT', urgent: false },
              { label: 'COGS MTD', value: formatGBP(retailKpis.mtdCogs), sub: 'Cost of goods sold', urgent: false },
              {
                label: 'Gross Profit MTD', value: formatGBP(retailKpis.grossProfitMtd),
                sub: `${retailKpis.grossProfitMtdPct.toFixed(1)}% margin`,
                urgent: retailKpis.grossProfitMtd < 0,
              },
              { label: 'Basket Size', value: formatGBP(retailKpis.avgTransactionValue), sub: `${retailKpis.todayTransactionCount} transactions`, urgent: false },
              { label: 'Wage Cost %', value: `${retailKpis.wageCostRatio.toFixed(1)}%`, sub: 'Wages / Sales', urgent: retailKpis.wageCostRatio > 30 },
              { label: 'Waste', value: formatGBP(retailKpis.wasteValueToday), sub: 'Expired stock', urgent: retailKpis.wasteValueToday > 0 },
              { label: 'Expiry Alerts', value: String(retailKpis.expiryAlerts7Day), sub: 'Expiring in 7 days', urgent: retailKpis.expiryAlerts7Day > 0 },
            ].map((item, i) => (
              <KpiCard key={item.label} title={item.label} value={item.value} sub={item.sub}
                icon={TrendingDown} urgent={item.urgent} delay={i * 60} />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}