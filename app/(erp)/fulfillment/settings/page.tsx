'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Settings, Loader2, Save } from 'lucide-react'
import { SettingsSkeleton } from '@/components/modules/fulfillment/FulfillmentSkeletons'

type FulfillmentSettings = {
  notes: string
}

export default function FulfillmentSettingsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FulfillmentSettings>({ notes: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['fulfillment-settings'],
    queryFn: () => api.get<FulfillmentSettings>('/api/fulfillment/settings').then((r) => r.data!),
  })

  useEffect(() => {
    if (data) {
      setForm(data)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (body: unknown) => api.patch('/api/fulfillment/settings', body),
    onSuccess: (res) => {
      if (res.success && res.data) queryClient.setQueryData(['fulfillment-settings'], res.data)
      queryClient.invalidateQueries({ queryKey: ['fulfillment-settings'] })
      toast.success('Settings saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <SettingsSkeleton />

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(form)
  }

  const update = <K extends keyof FulfillmentSettings>(key: K, value: FulfillmentSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fulfillment Settings"
        description="Configure fulfillment operations"
        icon={Settings}
        iconColor="text-indigo-600"
      />

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Notes</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <Textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} placeholder="Internal notes about fulfillment configuration" />
          </CardContent>
        </Card>

        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />Save Settings
        </Button>
      </form>
    </div>
  )
}
