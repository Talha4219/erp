'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewVehiclePage() {
  const router = useRouter()

  const [plate, setPlate] = useState('')
  const [type, setType] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [capacity, setCapacity] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [notes, setNotes] = useState('')

  const createMutation = useMutation({
    mutationFn: (body: unknown) => api.post<{ id: string }>('/api/fulfillment/vehicles', body),
    onSuccess: (res) => {
      if (!res.data?.id) { toast.error('Failed to create vehicle'); return }
      toast.success('Vehicle created')
      router.push(`/fulfillment/vehicles/${res.data.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      registrationNo: plate || undefined,
      type: type || undefined,
      make: make || undefined,
      model: model || undefined,
      year: year ? parseInt(year) : undefined,
      capacity: capacity ? parseFloat(capacity) : undefined,
      fuelType: fuelType || undefined,
      notes: notes || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Vehicle"
        description="Add a delivery vehicle"
        icon={Plus}
        iconColor="text-indigo-600"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/fulfillment/vehicles"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Vehicle Details</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-4">
            <p className="text-xs text-muted-foreground">Vehicle code will be auto-generated</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plate</Label>
                <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="e.g. ABC 1234" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Truck" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Make</Label>
                <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="e.g. Toyota" />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Hilux" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Input type="number" min="1990" max="2030" value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Capacity (kg)</Label>
                <Input type="number" step="0.1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 1000" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fuel Type</Label>
              <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select...</option>
                <option value="PETROL">Petrol</option>
                <option value="DIESEL">Diesel</option>
                <option value="ELECTRIC">Electric</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" rows={2} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-6">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Vehicle
          </Button>
          <Button variant="outline" type="button" asChild>
            <Link href="/fulfillment/vehicles">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
