'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FulfillmentStatusBadge } from '@/components/modules/fulfillment/FulfillmentStatusBadge'
import { toast } from 'sonner'
import { User, Eye, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

type Driver = { id: string; name: string; email: string; phone: string; status: string; licenseNumber: string; activeDeliveries: number }

export function PageClient({ initialData }: { initialData: Driver[] }) {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['fulfillment-drivers'],
    queryFn: () => api.get<Driver[]>('/api/fulfillment/drivers').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (driverId: string) => api.delete(`/api/fulfillment/drivers/${driverId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment-drivers'] })
      toast.success('Driver deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Drivers" description="Manage delivery drivers" icon={User} iconColor="text-indigo-600"
        actions={<Button asChild><Link href="/fulfillment/drivers/new"><Plus className="mr-2 h-4 w-4" />New Driver</Link></Button>}
      />
      <DataTable
        columns={[
          { key: 'name', header: 'Name', sortable: true },
          { key: 'email', header: 'Email' },
          { key: 'phone', header: 'Phone' },
          { key: 'licenseNumber', header: 'License #' },
          { key: 'activeDeliveries', header: 'Active Deliveries', render: (r: Driver) => <Badge variant="secondary">{r.activeDeliveries}</Badge> },
          { key: 'status', header: 'Status', render: (r: Driver) => <FulfillmentStatusBadge status={r.status} /> },
        ]}
        data={data ?? []}
        isLoading={isLoading} error={error}
        actions={(row) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/fulfillment/drivers/${row.id}`}><Eye className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteMutation.mutate(row.id)} disabled={deleteMutation.isPending}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />
    </div>
  )
}
