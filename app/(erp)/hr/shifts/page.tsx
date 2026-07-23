'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns'

type Employee = { id: string; firstName: string; lastName: string; employeeCode: string }
type Shift = {
  id: number
  employeeId: string
  shiftDate: string
  startTime: string
  endTime: string
  employee: Employee
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDates(weekStart: Date) {
  return DAYS.map((_, i) => addDays(weekStart, i))
}

export default function ShiftsPage() {
  const qc = useQueryClient()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState({ employeeId: '', shiftDate: '', startTime: '09:00', endTime: '17:00' })
  const [filterEmployee, setFilterEmployee] = useState('all')

  const weekDates = getWeekDates(weekStart)
  const from = format(weekDates[0], 'yyyy-MM-dd')
  const to = format(weekDates[6], 'yyyy-MM-dd')

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get<{ employees: Employee[] }>('/api/hr/employees').then((r) => r.data?.employees ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', from, to, filterEmployee],
    queryFn: () =>
      api.get<Shift[]>('/api/hr/shifts', {
        from,
        to,
        ...(filterEmployee !== 'all' && { employee: filterEmployee }),
      }).then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const createMut = useMutation({
    mutationFn: (payload: typeof form) => api.post('/api/hr/shifts', payload),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['shifts'] })
      const previous = qc.getQueryData(['shifts'])
      const employee = employees.find(e => e.id === newData.employeeId)
      qc.setQueryData(['shifts'], (old: any[]) => [{ ...newData, id: Date.now(), employee: employee ?? { id: newData.employeeId, firstName: '', lastName: '', employeeCode: '' } }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Shift added') },
    onError: (e: Error, _newData, context) => { if (context?.previous) qc.setQueryData(['shifts'], context.previous); toast.error(e.message) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); setShowForm(false); setForm({ employeeId: '', shiftDate: '', startTime: '09:00', endTime: '17:00' }) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/hr/shifts/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['shifts'] })
      const previous = qc.getQueryData(['shifts'])
      qc.setQueryData(['shifts'], (old: any[]) => old.filter((item: any) => item.id !== id))
      return { previous }
    },
    onSuccess: () => { toast.success('Shift removed') },
    onError: (e: Error, id, context) => { if (context?.previous) qc.setQueryData(['shifts'], context.previous); toast.error(e.message) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); setDeleteId(null) },
  })

  function shiftsForDay(date: Date) {
    return shifts.filter((s) => isSameDay(new Date(s.shiftDate), date))
  }

  const uniqueEmployees = useMemo(() => {
    const seen = new Set<string>()
    return shifts.map((s) => s.employee).filter((e) => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
  }, [shifts])

  const displayEmployees = filterEmployee !== 'all'
    ? employees.filter((e) => e.id === filterEmployee)
    : uniqueEmployees.length > 0 ? uniqueEmployees : employees.slice(0, 10)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Shift Scheduling"
        description="Weekly roster — assign and manage employee shifts"
        actions={<Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Add Shift</Button>}
      />

      {/* Week navigation */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[180px] text-center">
          {format(weekDates[0], 'dd MMM')} – {format(weekDates[6], 'dd MMM yyyy')}
        </span>
        <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-48 ml-4"><SelectValue placeholder="All employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Roster grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left w-40 font-medium">Employee</th>
                {weekDates.map((d, i) => (
                  <th key={i} className="p-3 text-center font-medium min-w-[100px]">
                    <div>{DAYS[i]}</div>
                    <div className="text-xs text-muted-foreground">{format(d, 'dd MMM')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : displayEmployees.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No shifts this week</td></tr>
              ) : (
                displayEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3">
                      <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                      <div className="text-xs text-muted-foreground">{emp.employeeCode}</div>
                    </td>
                    {weekDates.map((d, i) => {
                      const dayShifts = shiftsForDay(d).filter((s) => s.employeeId === emp.id)
                      return (
                        <td key={i} className="p-1 align-top">
                          {dayShifts.map((s) => (
                            <div key={s.id} className="mb-1 bg-primary/10 rounded p-1 text-xs flex items-center justify-between group">
                              <span>{s.startTime}–{s.endTime}</span>
                              <button
                                className="opacity-0 group-hover:opacity-100 text-destructive ml-1"
                                onClick={() => setDeleteId(s.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          <button
                            className="w-full text-xs text-muted-foreground border border-dashed rounded p-1 hover:bg-muted/30 hover:text-foreground opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                            onClick={() => {
                              setForm((f) => ({ ...f, employeeId: emp.id, shiftDate: format(d, 'yyyy-MM-dd') }))
                              setShowForm(true)
                            }}
                          >
                            + Add
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Add shift dialog */}
      <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Shift</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form) }} className="space-y-4">
            <div className="space-y-1">
              <Label>Employee</Label>
              <Select value={form.employeeId} onValueChange={(v) => setForm((f) => ({ ...f, employeeId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={form.shiftDate} onChange={(e) => setForm((f) => ({ ...f, shiftDate: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Start Time</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label>End Time</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending || !form.employeeId || !form.shiftDate}>
                {createMut.isPending ? 'Saving…' : 'Add Shift'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Remove Shift"
        description="Remove this shift from the roster?"
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)}
        loading={deleteMut.isPending}
      />
    </div>
  )
}
