'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { StatCard } from '@/components/shared/StatCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar, X, Users, CheckCircle2, XCircle, Clock3, UserX, TrendingUp, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, cn } from '@/lib/utils'
import dynamic from 'next/dynamic'
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false })
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HALF_DAY'

type Employee = {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  profileImage: string | null
  department: { name: string } | null
}

type AttendanceRecord = {
  id: string
  employeeId: string
  employee: { firstName: string; lastName: string; employeeCode: string }
  date: string
  status: AttendanceStatus
  checkIn: string | null
  checkOut: string | null
  hoursWorked: number | null
  notes: string | null
}

type DashboardData = {
  kpis: {
    totalEmployees: number; presentToday: number; absentToday: number
    onLeaveToday: number; halfDayToday: number; notMarkedToday: number; attendanceRateToday: number
  }
  trend: Array<{ date: string; present: number; absent: number; leave: number; halfDay: number; rate: number }>
  employeeSummaries: Array<{
    employeeId: string; name: string; employeeCode: string; department: string | null
    present: number; absent: number; leave: number; halfDay: number; markedDays: number; rate: number
  }>
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary'; active: string; idle: string }> = {
  PRESENT:  { label: 'Present',  variant: 'success',     active: 'bg-green-500 text-white',  idle: 'bg-muted text-muted-foreground hover:bg-green-100 hover:text-green-700' },
  LEAVE:    { label: 'Leave',    variant: 'secondary',   active: 'bg-gray-500 text-white',   idle: 'bg-muted text-muted-foreground hover:bg-gray-200 hover:text-gray-700' },
  ABSENT:   { label: 'Absent',   variant: 'destructive', active: 'bg-red-500 text-white',    idle: 'bg-muted text-muted-foreground hover:bg-red-100 hover:text-red-700' },
  HALF_DAY: { label: 'Half Day', variant: 'warning',     active: 'bg-amber-500 text-white',  idle: 'bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-700' },
}

const MARK_STATUSES: AttendanceStatus[] = ['PRESENT', 'LEAVE', 'ABSENT']

export default function AttendancePage() {
  const qc = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))
  const [filterStatus, setFilterStatus] = useState('')
  const [drillDownId, setDrillDownId] = useState<string | null>(null)

  const selDate = new Date(selectedDate + 'T00:00:00')
  const selMonth = String(selDate.getMonth() + 1)
  const selYear = String(selDate.getFullYear())

  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get<{ employees: Employee[] }>('/api/hr/employees').then((r) => r.data?.employees ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { data: dashboard } = useQuery({
    queryKey: ['attendance-dashboard', selMonth, selYear],
    queryFn: () => api.get<DashboardData>(`/api/hr/attendance/dashboard?month=${selMonth}&year=${selYear}`).then((r) => r.data!),
  })

  const { data: dayRecords } = useQuery({
    queryKey: ['attendance-day', selectedDate],
    queryFn: () =>
      api.get<AttendanceRecord[]>(`/api/hr/attendance?month=${selMonth}&year=${selYear}`)
        .then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const attendanceMap = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {}
    for (const r of dayRecords ?? []) {
      if (r.date.slice(0, 10) === selectedDate) map[r.employeeId] = r.status
    }
    return map
  }, [dayRecords, selectedDate])

  const buildHistoryQuery = () => {
    const p = new URLSearchParams()
    if (filterEmployee) p.set('employee', filterEmployee)
    if (filterMonth && filterYear) { p.set('month', filterMonth); p.set('year', filterYear) }
    return p.toString()
  }

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['attendance', filterEmployee, filterMonth, filterYear],
    queryFn: () => api.get<AttendanceRecord[]>(`/api/hr/attendance?${buildHistoryQuery()}`).then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { data: drillDownData, isLoading: drillDownLoading } = useQuery({
    queryKey: ['attendance', drillDownId, selMonth, selYear],
    queryFn: () => api.get<AttendanceRecord[]>(`/api/hr/attendance?employee=${drillDownId}&month=${selMonth}&year=${selYear}`).then((r) => r.data ?? []),
    enabled: !!drillDownId,
    placeholderData: (previousData) => previousData,
  })

  const mutation = useMutation({
    mutationFn: ({ employeeId, status }: { employeeId: string; status: AttendanceStatus }) =>
      api.post('/api/hr/attendance', { employeeId, date: selectedDate, status }),
    onMutate: async ({ employeeId, status }) => {
      await qc.cancelQueries({ queryKey: ['attendance-day', selectedDate] })
      const previous = qc.getQueryData(['attendance-day', selectedDate])
      qc.setQueryData(['attendance-day', selectedDate], (old: any[]) => {
        const filtered = (old ?? []).filter((r: any) => r.employeeId !== employeeId)
        return [{ id: 'temp-' + Date.now(), employeeId, employee: { firstName: '', lastName: '', employeeCode: '' }, date: selectedDate, status, checkIn: null, checkOut: null, hoursWorked: null, notes: null }, ...filtered]
      })
      setPendingId(employeeId)
      return { previous }
    },
    onSuccess: () => { toast.success('Attendance marked') },
    onError: (err, vars, context) => { if (context?.previous) qc.setQueryData(['attendance-day', selectedDate], context.previous); toast.error('Failed to mark attendance') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['attendance-day', selectedDate] }); qc.invalidateQueries({ queryKey: ['attendance'] }); qc.invalidateQueries({ queryKey: ['attendance-dashboard'] }); setPendingId(null) },
  })

  const empList = employees ?? []
  const k = dashboard?.kpis
  const drillDownEmployee = dashboard?.employeeSummaries.find((e) => e.employeeId === drillDownId)

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance Dashboard" description="Manage daily attendance and review every employee's history" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard title="Total Employees" value={k?.totalEmployees ?? 0} icon={Users} iconColor="text-blue-600" accent="bg-blue-500" />
        <StatCard title="Present Today" value={k?.presentToday ?? 0} icon={CheckCircle2} iconColor="text-emerald-600" accent="bg-emerald-500" />
        <StatCard title="Absent Today" value={k?.absentToday ?? 0} icon={XCircle} iconColor="text-red-600" accent="bg-red-500" urgent={(k?.absentToday ?? 0) > 0} />
        <StatCard title="On Leave" value={k?.onLeaveToday ?? 0} icon={Clock3} iconColor="text-slate-600" accent="bg-slate-400" />
        <StatCard title="Not Marked" value={k?.notMarkedToday ?? 0} icon={UserX} iconColor="text-amber-600" accent="bg-amber-500" />
        <StatCard title="Attendance Rate" value={`${k?.attendanceRateToday ?? 0}%`} icon={TrendingUp} iconColor="text-purple-600" accent="bg-purple-500" />
      </div>

      {/* Monthly trend */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />Attendance Rate Trend — {selDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {(dashboard?.trend ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No attendance recorded this month yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={dashboard?.trend ?? []} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="attRateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(8, 10)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} width={36} domain={[0, 100]} />
                <Tooltip formatter={(v: unknown) => `${v}%`} labelFormatter={(d: unknown) => formatDate(String(d))} />
                <Area type="monotone" dataKey="rate" name="Attendance Rate" stroke="#10b981" strokeWidth={2} fill="url(#attRateGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Date selector */}
      <div className="flex items-center gap-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-44"
        />
        <span className="text-sm text-muted-foreground">
          {empList.length} employee{empList.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Employee attendance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {empList.map((emp) => {
          const status = attendanceMap[emp.id]
          const isPending = pendingId === emp.id
          const initials = `${emp.firstName[0] ?? ''}${emp.lastName[0] ?? ''}`.toUpperCase()
          const summary = dashboard?.employeeSummaries.find((e) => e.employeeId === emp.id)

          return (
            <div
              key={emp.id}
              role="button"
              tabIndex={0}
              onClick={() => setDrillDownId(emp.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') setDrillDownId(emp.id) }}
              className="group rounded-xl border bg-card shadow-sm p-4 flex flex-col items-center gap-3 cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
            >
              {/* Profile picture or initials */}
              <div className="relative">
                {emp.profileImage ? (
                  <img
                    src={emp.profileImage}
                    alt={`${emp.firstName} ${emp.lastName}`}
                    className="h-16 w-16 rounded-full object-cover border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-primary/10 border flex items-center justify-center text-xl font-bold text-primary select-none">
                    {initials}
                  </div>
                )}
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-4 w-4 text-white" />
                </span>
                {status && (
                  <span
                    className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${
                      status === 'PRESENT' ? 'bg-green-500' :
                      status === 'ABSENT'  ? 'bg-red-500'   :
                      status === 'LEAVE'   ? 'bg-gray-400'  : 'bg-amber-500'
                    }`}
                  />
                )}
              </div>

              {/* Name & info */}
              <div className="text-center">
                <p className="font-semibold text-sm leading-tight group-hover:underline">{emp.firstName} {emp.lastName}</p>
                <p className="text-xs text-muted-foreground">{emp.employeeCode}</p>
                {emp.department && <p className="text-xs text-muted-foreground">{emp.department.name}</p>}
                {summary && <p className="text-[10px] text-muted-foreground mt-0.5">{summary.rate}% this month</p>}
              </div>

              {/* Current status badge */}
              {status ? (
                <Badge variant={STATUS_CONFIG[status].variant} className="text-xs">
                  {STATUS_CONFIG[status].label}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">Not marked</Badge>
              )}

              {/* Mark attendance buttons */}
              <div className="flex gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                {MARK_STATUSES.map((s) => (
                  <button
                    key={s}
                    disabled={isPending}
                    onClick={() => mutation.mutate({ employeeId: emp.id, status: s })}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      status === s ? STATUS_CONFIG[s].active : STATUS_CONFIG[s].idle
                    }`}
                  >
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Attendance history */}
      <div className="pt-6 border-t space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Attendance History</h3>
        <div className="flex gap-3 flex-wrap">
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All employees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Employees</SelectItem>
              {empList.map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All months" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Months</SelectItem>
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="w-24"
            placeholder="Year"
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterEmployee || filterMonth || filterStatus) && (
            <Button variant="outline" size="sm" onClick={() => { setFilterEmployee(''); setFilterMonth(''); setFilterStatus('') }}>
              <X className="h-4 w-4 mr-1" />Clear
            </Button>
          )}
        </div>
        <DataTable
          columns={[
            { key: 'date', header: 'Date', render: (r: AttendanceRecord) => formatDate(r.date) },
            {
              key: 'employee', header: 'Employee', render: (r: AttendanceRecord) => (
                <button className="hover:underline text-left" onClick={() => setDrillDownId(r.employeeId)}>
                  {r.employee.firstName} {r.employee.lastName} ({r.employee.employeeCode})
                </button>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (r: AttendanceRecord) => (
                <Badge variant={STATUS_CONFIG[r.status]?.variant ?? 'secondary'}>
                  {STATUS_CONFIG[r.status]?.label ?? r.status}
                </Badge>
              ),
            },
            { key: 'checkIn',     header: 'Check In',  render: (r: AttendanceRecord) => r.checkIn     ? new Date(r.checkIn).toLocaleTimeString()  : '-' },
            { key: 'checkOut',    header: 'Check Out', render: (r: AttendanceRecord) => r.checkOut    ? new Date(r.checkOut).toLocaleTimeString() : '-' },
            { key: 'hoursWorked', header: 'Hours',     render: (r: AttendanceRecord) => r.hoursWorked ? `${r.hoursWorked}h`                        : '-' },
          ]}
          data={(historyData ?? []).filter((r) => !filterStatus || r.status === filterStatus)}
          isLoading={historyLoading}
        />
      </div>

      {/* Per-employee drill-down dialog */}
      <Dialog open={!!drillDownId} onOpenChange={(o) => !o && setDrillDownId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{drillDownEmployee?.name ?? 'Employee'} — Attendance History</DialogTitle>
          </DialogHeader>
          {drillDownEmployee && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: 'Present', value: drillDownEmployee.present, cls: 'text-emerald-600' },
                { label: 'Absent', value: drillDownEmployee.absent, cls: 'text-red-600' },
                { label: 'Leave', value: drillDownEmployee.leave, cls: 'text-slate-600' },
                { label: 'Half Day', value: drillDownEmployee.halfDay, cls: 'text-amber-600' },
                { label: 'Rate', value: `${drillDownEmployee.rate}%`, cls: 'text-purple-600' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="rounded-lg border p-2.5 text-center">
                  <p className={cn('text-lg font-bold', cls)}>{value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">{label}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2">
            {drillDownLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : (drillDownData ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No records for this month.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="pb-2 text-left">Date</th><th className="pb-2 text-left">Status</th>
                  <th className="pb-2 text-left">Check In</th><th className="pb-2 text-left">Check Out</th>
                </tr></thead>
                <tbody className="divide-y">
                  {(drillDownData ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="py-2">{formatDate(r.date)}</td>
                      <td className="py-2"><Badge variant={STATUS_CONFIG[r.status]?.variant ?? 'secondary'} className="text-xs">{STATUS_CONFIG[r.status]?.label ?? r.status}</Badge></td>
                      <td className="py-2">{r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '—'}</td>
                      <td className="py-2">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
