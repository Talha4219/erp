'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Plus, Pencil, Trash2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { toast } from 'sonner'

type Device = {
  id: string
  name: string
  deviceCode: string
  location: string | null
  ipAddress: string | null
  isActive: boolean
  lastSyncAt: string | null
  _count: { logs: number }
}

type BiometricLog = {
  id: string
  rawUserId: string
  punchTime: string
  punchType: string
  processed: boolean
  device: { name: string; deviceCode: string }
  employee: { firstName: string; lastName: string; employeeCode: string } | null
}

const emptyDevice = { name: '', deviceCode: '', location: '', ipAddress: '', isActive: true }

export default function BiometricPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Device | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyDevice)
  const [syncing, setSyncing] = useState(false)

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['biometric-devices'],
    queryFn: () => api.get<Device[]>('/api/hr/biometric/devices').then(r => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['biometric-logs'],
    queryFn: () => api.get<BiometricLog[]>('/api/hr/biometric/sync').then(r => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const pendingLogs = logs.filter(l => !l.processed).length

  const saveMutation = useMutation({
    mutationFn: (data: typeof emptyDevice) =>
      editing
        ? api.put(`/api/hr/biometric/devices/${editing.id}`, data)
        : api.post('/api/hr/biometric/devices', data),
    onSuccess: () => {
      toast.success(editing ? 'Device updated' : 'Device added')
      qc.invalidateQueries({ queryKey: ['biometric-devices'] })
      setShowForm(false)
      setEditing(null)
      setForm(emptyDevice)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/hr/biometric/devices/${id}`),
    onSuccess: () => {
      toast.success('Device removed')
      qc.invalidateQueries({ queryKey: ['biometric-devices'] })
      setDeleteId(null)
    },
    onError: () => toast.error('Failed to remove device'),
  })

  const openAdd = () => { setEditing(null); setForm(emptyDevice); setShowForm(true) }
  const openEdit = (d: Device) => {
    setEditing(d)
    setForm({ name: d.name, deviceCode: d.deviceCode, location: d.location ?? '', ipAddress: d.ipAddress ?? '', isActive: d.isActive })
    setShowForm(true)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await api.post<{ processed: number; created: number; updated: number; errors: string[] }>('/api/hr/biometric/sync', {})
      const d = res.data!
      toast.success(`Sync complete — ${d.created} attendance records created, ${d.updated} updated`)
      qc.invalidateQueries({ queryKey: ['biometric-logs'] })
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const deviceCols = [
    { key: 'name', header: 'Device Name', sortable: true },
    { key: 'deviceCode', header: 'Code' },
    { key: 'location', header: 'Location', render: (r: Device) => r.location ?? '-' },
    { key: 'ipAddress', header: 'IP Address', render: (r: Device) => r.ipAddress ?? '-' },
    {
      key: 'isActive',
      header: 'Status',
      render: (r: Device) => (
        <Badge variant={r.isActive ? 'success' : 'secondary'}>
          {r.isActive ? <><Wifi className="inline h-3 w-3 mr-1" />Online</> : <><WifiOff className="inline h-3 w-3 mr-1" />Offline</>}
        </Badge>
      ),
    },
    { key: 'lastSyncAt', header: 'Last Sync', render: (r: Device) => r.lastSyncAt ? new Date(r.lastSyncAt).toLocaleString() : 'Never' },
    { key: '_count', header: 'Total Punches', render: (r: Device) => r._count.logs },
  ]

  const logCols = [
    { key: 'punchTime', header: 'Time', render: (r: BiometricLog) => new Date(r.punchTime).toLocaleString() },
    { key: 'device', header: 'Device', render: (r: BiometricLog) => r.device.name },
    { key: 'rawUserId', header: 'Raw User ID' },
    { key: 'employee', header: 'Matched Employee', render: (r: BiometricLog) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : <span className="text-muted-foreground">Unmatched</span> },
    { key: 'punchType', header: 'Type', render: (r: BiometricLog) => <Badge variant="secondary">{r.punchType}</Badge> },
    {
      key: 'processed',
      header: 'Status',
      render: (r: BiometricLog) => (
        <Badge variant={r.processed ? 'success' : 'warning'}>{r.processed ? 'Processed' : 'Pending'}</Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biometric Integration"
        description="Manage biometric devices and sync attendance punches"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : `Sync Punches${pendingLogs > 0 ? ` (${pendingLogs})` : ''}`}
            </Button>
            <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add Device</Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Devices</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{devices.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Devices</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{devices.filter(d => d.isActive).length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending Punches</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{pendingLogs}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="devices">
        <TabsList>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="logs">Punch Logs</TabsTrigger>
          <TabsTrigger value="webhook">Webhook Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="mt-4">
          <DataTable
            columns={deviceCols}
            data={devices}
            isLoading={isLoading}
            actions={(row) => (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <DataTable columns={logCols} data={logs} isLoading={logsLoading} />
        </TabsContent>

        <TabsContent value="webhook" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Webhook Integration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure your biometric device to POST punches to the endpoint below. The system matches punches
                to employees using <code className="bg-muted px-1 rounded">rawUserId</code> = <code className="bg-muted px-1 rounded">employeeCode</code>.
              </p>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/hr/biometric/punch`} />
                  <Button variant="outline" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/hr/biometric/punch`); toast.success('Copied') }}>Copy</Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Payload Format (JSON)</Label>
                <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{JSON.stringify({ deviceCode: 'DEV001', rawUserId: 'EMP001', punchTime: new Date().toISOString(), punchType: 'IN' }, null, 2)}</pre>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>punchType</strong>: <code>IN</code> | <code>OUT</code> | <code>UNKNOWN</code>
                <br />After punches are received, click <strong>Sync Punches</strong> to convert them into attendance records.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Device' : 'Add Biometric Device'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {[
              { label: 'Device Name', key: 'name', placeholder: 'Main Entrance Scanner' },
              { label: 'Device Code', key: 'deviceCode', placeholder: 'DEV001' },
              { label: 'Location', key: 'location', placeholder: 'Ground Floor Lobby' },
              { label: 'IP Address', key: 'ipAddress', placeholder: '192.168.1.100' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  placeholder={placeholder}
                  value={form[key as keyof typeof form] as string}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Remove Device"
        description="This will remove the device and all its punch logs. Are you sure?"
      />
    </div>
  )
}
