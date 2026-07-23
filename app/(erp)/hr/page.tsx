'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getAppCurrencySymbol } from '@/lib/currency-store'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false })
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false })
import {
  Users, Clock, Banknote, Briefcase, UserCheck, Fingerprint,
  FileText, Plus, TrendingUp, AlertCircle, AlertTriangle,
  CheckCircle, Calendar, Building, Star,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type HRDash = {
  totalEmployees: number
  activeEmployees: number
  newHiresThisMonth: number
  pendingLeaves: number
  approvedLeavesToday: number
  totalPayrollMtd: number
  openPositions: number
  attendance: { present: number; absent: number; halfDay: number; onLeave: number }
  departmentDistribution: Array<{ name: string; count: number }>
  recentJoinees: Array<{ id: string; firstName: string; lastName: string; department: { name: string } | null; designation: { name: string } | null; joinDate: string }>
  pendingLeaveRequests: Array<{ id: string; employee: { firstName: string; lastName: string }; leaveType: { name: string }; startDate: string; endDate: string; status: string }>
  payrollTrend: Array<{ month: string; total: number }>
}

const DEPT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899', '#3b82f6']

const MODULE_SHORTCUTS = [
  { href: '/hr/employees', label: 'Employees', icon: Users, color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  { href: '/hr/attendance', label: 'Attendance', icon: Clock, color: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100' },
  { href: '/hr/attendance/biometric', label: 'Biometric', icon: Fingerprint, color: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' },
  { href: '/hr/leaves', label: 'Leave Requests', icon: Calendar, color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
  { href: '/hr/payroll', label: 'Payroll', icon: Banknote, color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
  { href: '/hr/payroll/components', label: 'Salary Components', icon: FileText, color: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' },
  { href: '/hr/recruitment', label: 'Recruitment', icon: Briefcase, color: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100' },
  { href: '/hr/performance', label: 'Performance', icon: Star, color: 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100' },
]

const LEAVE_BADGE: Record<string, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive', CANCELLED: 'secondary',
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/60 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-muted-foreground mb-1">{label}</p>
      <p className="font-bold text-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export default function HRPage() {
  const router = useRouter()
  const { data: d, isLoading, error } = useQuery({
    queryKey: ['hr-dash'],
    queryFn: () => api.get<HRDash>('/api/hr/dashboard').then(r => r.data!),
    staleTime: 60_000,
  })

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
        <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-white border border-border/50" />)}
        </div>
      </div>
    )
  }

  const att = d?.attendance ?? { present: 0, absent: 0, halfDay: 0, onLeave: 0 }
  const attData = [
    { name: 'Present', value: att.present, color: '#10b981' },
    { name: 'Absent', value: att.absent, color: '#ef4444' },
    { name: 'Half Day', value: att.halfDay, color: '#f59e0b' },
    { name: 'On Leave', value: att.onLeave, color: '#6366f1' },
  ].filter(x => x.value > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Human Resources"
        description="Employee management, attendance, payroll and recruitment overview"
        icon={Users}
        iconColor="text-pink-600"
        actions={
          <div className="flex gap-2">
            {(d?.pendingLeaves ?? 0) > 0 && (
              <Button variant="outline" size="sm" asChild className="border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100">
                <Link href="/hr/leaves">
                  <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                  {d!.pendingLeaves} Leave{d!.pendingLeaves !== 1 ? 's' : ''} Pending
                </Link>
              </Button>
            )}
            <Button size="sm" asChild>
              <Link href="/hr/employees">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Employee
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={d?.totalEmployees ?? 0}
          icon={Users}
          iconColor="text-blue-600"
          accent="bg-blue-500"
          onClick={() => router.push('/hr/employees')}
          description={`${d?.activeEmployees ?? 0} active`}
        />
        <StatCard
          title="New Hires (MTD)"
          value={d?.newHiresThisMonth ?? 0}
          icon={UserCheck}
          iconColor="text-emerald-600"
          accent="bg-emerald-500"
          changeType={(d?.newHiresThisMonth ?? 0) > 0 ? 'positive' : 'neutral'}
          change={(d?.newHiresThisMonth ?? 0) > 0 ? 'This month' : 'No new hires'}
        />
        <StatCard
          title="Leave Requests"
          value={d?.pendingLeaves ?? 0}
          icon={Calendar}
          iconColor={(d?.pendingLeaves ?? 0) > 0 ? 'text-amber-500' : 'text-emerald-500'}
          accent={(d?.pendingLeaves ?? 0) > 0 ? 'bg-amber-500' : 'bg-emerald-500'}
          urgent={(d?.pendingLeaves ?? 0) > 0}
          onClick={() => router.push('/hr/leaves')}
          change={(d?.pendingLeaves ?? 0) > 0 ? 'Awaiting approval' : 'All processed'}
          changeType={(d?.pendingLeaves ?? 0) > 0 ? 'negative' : 'positive'}
        />
        <StatCard
          title="Payroll MTD"
          value={formatCurrency(d?.totalPayrollMtd ?? 0)}
          icon={Banknote}
          iconColor="text-pink-600"
          accent="bg-pink-500"
          onClick={() => router.push('/hr/payroll')}
        />
      </div>

      {/* Quick Access */}
      <div>
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Quick Access</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {MODULE_SHORTCUTS.map(({ href, label, icon: Icon, color }) => (
            <Link key={href} href={href}>
              <div className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-3 cursor-pointer transition-all', color)}>
                <Icon className="h-4 w-4" />
                <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Today's attendance + Department distribution */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Attendance */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-teal-500" />
                Today&apos;s Attendance
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" asChild>
                <Link href="/hr/attendance">View</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {attData.length === 0 ? (
              <EmptyState icon={Clock} title="No attendance data today" className="py-6" />
            ) : (
              <>
                <div className="flex justify-center">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={attData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {attData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {attData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-xs text-muted-foreground">{item.name}</span>
                      <span className="ml-auto text-xs font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Department distribution */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building className="h-4 w-4 text-indigo-500" />
              By Department
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.departmentDistribution ?? []).length === 0 ? (
              <EmptyState icon={Building} title="No department data" className="py-6" />
            ) : (
              <div className="space-y-2.5">
                {(d?.departmentDistribution ?? []).map((dept, i) => {
                  const max = Math.max(...(d?.departmentDistribution ?? []).map(x => x.count), 1)
                  return (
                    <div key={dept.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate max-w-[120px]">{dept.name}</span>
                        <span className="text-xs font-semibold text-muted-foreground">{dept.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(dept.count / max) * 100}%`, background: DEPT_COLORS[i % DEPT_COLORS.length] }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payroll trend */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-1 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-pink-500" />
              Payroll Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {(d?.payrollTrend ?? []).length === 0 ? (
              <EmptyState icon={Banknote} title="No payroll history" className="py-6" />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={d?.payrollTrend ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="payrollGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${getAppCurrencySymbol()}${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="#ec4899" strokeWidth={2} fill="url(#payrollGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent joinees + Pending leaves */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-blue-500" />
              Recent Joinees
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link href="/hr/employees">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.recentJoinees ?? []).length === 0 ? (
              <EmptyState icon={Users} title="No recent hires" className="py-8" />
            ) : (
              <div className="space-y-2">
                {(d?.recentJoinees ?? []).map((emp) => (
                  <Link key={emp.id} href={`/hr/employees`}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/50 transition-colors group">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-xs font-bold text-white">
                      {emp.firstName[0]}{emp.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{emp.firstName} {emp.lastName}</p>
                      <p className="text-[11px] text-muted-foreground">{emp.designation?.name ?? '—'} · {emp.department?.name ?? '—'}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground flex-shrink-0">{formatDate(emp.joinDate)}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              Pending Leave Requests
              {(d?.pendingLeaves ?? 0) > 0 && (
                <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700 px-1">
                  {d!.pendingLeaves}
                </span>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link href="/hr/leaves">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.pendingLeaveRequests ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
                <p className="text-xs text-muted-foreground">No pending leave requests</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(d?.pendingLeaveRequests ?? []).map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{req.employee.firstName} {req.employee.lastName}</p>
                      <p className="text-[11px] text-muted-foreground">{req.leaveType.name} · {formatDate(req.startDate)} – {formatDate(req.endDate)}</p>
                    </div>
                    <Badge variant={LEAVE_BADGE[req.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0 flex-shrink-0">
                      {req.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
