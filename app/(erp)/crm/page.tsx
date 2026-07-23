'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Target, Activity, TrendingUp, Phone, Calendar, FileText, Mail, UserCheck, Megaphone, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const STAGE_COLORS: Record<string, string> = {
  PROSPECTING: 'bg-gray-200', QUALIFICATION: 'bg-blue-200', PROPOSAL: 'bg-yellow-200',
  NEGOTIATION: 'bg-orange-200', CLOSED_WON: 'bg-green-200', CLOSED_LOST: 'bg-red-200',
}
const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  CALL: Phone, MEETING: Calendar, NOTE: FileText, FOLLOW_UP: Target, EMAIL_LOG: Mail, TASK: Activity,
}

type DashData = {
  totalLeads: number; totalContacts: number; totalOpps: number; pipelineValue: number
  leadsByStatus: Record<string, number>
  oppsByStage: Array<{ stage: string; count: number; value: number }>
  recentActivities: Array<{ id: string; type: string; subject: string; createdAt: string; lead?: { firstName: string; lastName: string } | null; contact?: { firstName: string; lastName: string } | null; opportunity?: { title: string } | null }>
  recentLeads: Array<{ id: string; firstName: string; lastName: string; company: string | null; status: string; source: string }>
}

const quickLinks = [
  { href: '/crm/leads', label: 'Leads', icon: Users },
  { href: '/crm/contacts', label: 'Contacts', icon: UserCheck },
  { href: '/crm/opportunities', label: 'Opportunities', icon: Target },
  { href: '/crm/pipeline', label: 'Pipeline', icon: TrendingUp },
  { href: '/crm/activities', label: 'Activities', icon: Activity },
  { href: '/crm/campaigns', label: 'Campaigns', icon: Megaphone },
]

export default function CrmDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: () => api.get<DashData>('/api/crm/dashboard').then((r) => r.data!),
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

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>
  const d = data!
  return (
    <div className="space-y-6">
      <PageHeader title="CRM" description="Manage prospects, customers, and your sales pipeline" actions={<Button asChild><Link href="/crm/leads/new">Add Lead</Link></Button>} />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {quickLinks.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="flex flex-col items-center gap-1 p-3">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">{label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Leads" value={d.totalLeads} icon={Users} iconColor="text-blue-600" />
        <StatCard title="Contacts" value={d.totalContacts} icon={UserCheck} iconColor="text-purple-600" />
        <StatCard title="Opportunities" value={d.totalOpps} icon={Target} iconColor="text-orange-600" />
        <StatCard title="Pipeline Value" value={formatCurrency(d.pipelineValue)} icon={TrendingUp} iconColor="text-green-600" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Pipeline by Stage</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {d.oppsByStage.length === 0 ? <p className="text-sm text-muted-foreground">No opportunities yet.</p> : d.oppsByStage.map((s) => (
              <div key={s.stage} className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${STAGE_COLORS[s.stage] ?? 'bg-gray-200'}`} />
                <span className="flex-1 text-sm">{s.stage.replace(/_/g, ' ')}</span>
                <span className="text-xs text-muted-foreground">{s.count}</span>
                <span className="text-sm font-semibold">{formatCurrency(s.value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-base">Recent Leads</CardTitle><Button variant="ghost" size="sm" asChild><Link href="/crm/leads">View all</Link></Button></CardHeader>
          <CardContent className="space-y-2">
            {d.recentLeads.length === 0 ? <p className="text-sm text-muted-foreground">No leads yet.</p> : d.recentLeads.map((l) => (
              <Link key={l.id} href={`/crm/leads/${l.id}`} className="flex items-center justify-between rounded p-2 hover:bg-muted/50">
                <div><p className="text-sm font-medium">{l.firstName} {l.lastName}</p><p className="text-xs text-muted-foreground">{l.company ?? '—'} · {l.source}</p></div>
                <Badge variant="secondary" className="text-xs">{l.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-base">Recent Activities</CardTitle><Button variant="ghost" size="sm" asChild><Link href="/crm/activities">View all</Link></Button></CardHeader>
        <CardContent className="space-y-2">
          {d.recentActivities.length === 0 ? <p className="text-sm text-muted-foreground">No activities yet.</p> : d.recentActivities.map((a) => {
            const Icon = ACTIVITY_ICONS[a.type] ?? Activity
            const who = a.lead ? `${a.lead.firstName} ${a.lead.lastName}` : a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : a.opportunity?.title ?? '—'
            return (
              <div key={a.id} className="flex items-center gap-3 rounded p-2 hover:bg-muted/50">
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0"><p className="truncate text-sm font-medium">{a.subject}</p><p className="text-xs text-muted-foreground">{a.type.replace(/_/g, ' ')} · {who}</p></div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
