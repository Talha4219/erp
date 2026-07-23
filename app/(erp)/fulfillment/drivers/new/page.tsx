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

export default function NewDriverPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [notes, setNotes] = useState('')

  const createMutation = useMutation({
    mutationFn: (body: unknown) => api.post<{ id: string }>('/api/fulfillment/drivers', body),
    onSuccess: (res) => {
      if (!res.data?.id) { toast.error('Failed to create driver'); return }
      toast.success('Driver created')
      router.push(`/fulfillment/drivers/${res.data.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) {
      toast.error('Name is required')
      return
    }
    createMutation.mutate({
      name,
      email: email || undefined,
      contactNumber: contactNumber || undefined,
      licenseNumber: licenseNumber || undefined,
      notes: notes || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Driver"
        description="Add a delivery driver"
        icon={Plus}
        iconColor="text-indigo-600"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/fulfillment/drivers"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Driver Details</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Driver name" required />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="driver@example.com" required />
              </div>
            </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="Phone number" />
                </div>
                <div className="space-y-2">
                  <Label>License Number</Label>
                  <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="License #" />
                </div>
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
            Create Driver
          </Button>
          <Button variant="outline" type="button" asChild>
            <Link href="/fulfillment/drivers">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
