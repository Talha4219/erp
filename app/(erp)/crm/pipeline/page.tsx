'use client'
import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Link from 'next/link'

const STAGES = ['PROSPECTING','QUALIFICATION','PROPOSAL','NEGOTIATION','CLOSED_WON','CLOSED_LOST']
const STAGE_COLORS: Record<string, string> = {
  PROSPECTING: 'border-t-gray-400', QUALIFICATION: 'border-t-blue-400', PROPOSAL: 'border-t-yellow-400',
  NEGOTIATION: 'border-t-orange-400', CLOSED_WON: 'border-t-green-500', CLOSED_LOST: 'border-t-red-400',
}

type Opp = { id: string; title: string; stage: string; probability: number; value: number; customer: { name: string } | null; contact: { firstName: string; lastName: string } | null }

export default function PipelinePage() {
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery({ queryKey: ['crm-opps'], queryFn: () => api.get<Opp[]>('/api/crm/opportunities').then((r) => r.data ?? []), placeholderData: (previousData) => previousData })

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.patch(`/api/crm/opportunities/${id}`, { stage }),
    onSuccess: () => { toast.success('Stage updated'); qc.invalidateQueries({ queryKey: ['crm-opps'] }) },
  })

  const byStage = useMemo(() => {
    return Object.fromEntries(STAGES.map((s) => [s, data.filter((o) => o.stage === s)]))
  }, [data])

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>

  return (
    <div className="space-y-6">
      <PageHeader title="Sales Pipeline" description="Drag opportunities through stages" actions={<Button asChild><Link href="/crm/opportunities">Manage Opportunities</Link></Button>} />
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4" style={{ minWidth: `${STAGES.length * 240}px` }}>
          {STAGES.map((stage) => {
            const opps = byStage[stage] ?? []
            const total = opps.reduce((s, o) => s + Number(o.value), 0)
            return (
              <div key={stage} className="flex-1 min-w-[220px]">
                <Card className={`border-t-4 ${STAGE_COLORS[stage]}`}>
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{stage.replace(/_/g,' ')}</CardTitle>
                    <p className="text-sm font-semibold">{opps.length} · {formatCurrency(total)}</p>
                  </CardHeader>
                  <CardContent className="space-y-2 px-3 pb-3">
                    {opps.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Empty</p>}
                    {opps.map((opp) => (
                      <Card key={opp.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-3 space-y-1">
                          <Link href={`/crm/opportunities/${opp.id}`} className="text-sm font-medium hover:text-primary line-clamp-2">{opp.title}</Link>
                          <p className="text-xs text-muted-foreground">{opp.customer?.name ?? (opp.contact ? `${opp.contact.firstName} ${opp.contact.lastName}` : '—')}</p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-sm font-semibold">{formatCurrency(Number(opp.value))}</span>
                            <Badge variant="secondary" className="text-xs">{opp.probability}%</Badge>
                          </div>
                          {stage !== 'CLOSED_WON' && stage !== 'CLOSED_LOST' && (
                            <div className="flex gap-1 pt-1">
                              {STAGES.indexOf(stage) > 0 && (
                                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => moveMutation.mutate({ id: opp.id, stage: STAGES[STAGES.indexOf(stage) - 1] })}>← Back</Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-6 text-xs px-2 ml-auto" onClick={() => moveMutation.mutate({ id: opp.id, stage: STAGES[STAGES.indexOf(stage) + 1] })}>Next →</Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
