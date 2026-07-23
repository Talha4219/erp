'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { FulfillmentStatusBadge } from '@/components/modules/fulfillment/FulfillmentStatusBadge'
import { toast } from 'sonner'
import { Truck, Eye, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

type Vehicle = { id: string; vehicleNumber: string; registrationNo?: string | null; type?: string | null; status: string; capacity?: number | null }

export function PageClient({ initialData }: { initialData: Vehicle[] }) {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['fulfillment-vehicles'],
    queryFn: () => api.get<Vehicle[]>('/api/fulfillment/vehicles').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/fulfillment/vehicles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment-vehicles'] })
      toast.success('Vehicle deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Vehicles" description="Manage delivery vehicles" icon={Truck} iconColor="text-indigo-600"
        actions={<Button asChild><Link href="/fulfillment/vehicles/new"><Plus className="mr-2 h-4 w-4" />New Vehicle</Link></Button>}
      />
      <DataTable
        columns={[
          { key: 'vehicleNumber', header: 'Name', sortable: true },
          { key: 'registrationNo', header: 'Plate' },
          { key: 'type', header: 'Type' },
          { key: 'capacity', header: 'Capacity (kg)', render: (r: Vehicle) => r.capacity ? `${r.capacity} kg` : '-' },
          { key: 'status', header: 'Status', render: (r: Vehicle) => <FulfillmentStatusBadge status={r.status} /> },
        ]}
        data={data ?? []}
        isLoading={isLoading} error={error}
        actions={(row) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/fulfillment/vehicles/${row.id}`}><Eye className="h-4 w-4" /></Link>
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
