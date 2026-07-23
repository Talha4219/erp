import { cn } from '@/lib/utils'
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

type StatCardProps = {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: LucideIcon
  iconColor?: string
  description?: string
  urgent?: boolean
  onClick?: () => void
  accent?: string
}

export function StatCard({
  title, value, change, changeType = 'neutral',
  icon: Icon, iconColor = 'text-primary', description, urgent, onClick, accent,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-all duration-200',
        urgent ? 'border-red-200 bg-red-50/60' : 'border-border/60 hover:border-border hover:shadow-md',
        onClick && 'cursor-pointer',
      )}
      onClick={onClick}
    >
      {accent && <div className={cn('absolute inset-x-0 top-0 h-0.5', accent)} />}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 truncate">{title}</p>
          <p className={cn('mt-1.5 text-2xl font-bold leading-none tracking-tight', urgent && 'text-red-700')}>
            {value}
          </p>
          {(change || description) && (
            <div className="mt-1.5 flex items-center gap-1">
              {changeType === 'positive' && <ArrowUpRight className="h-3 w-3 text-emerald-500 flex-shrink-0" />}
              {changeType === 'negative' && <ArrowDownRight className="h-3 w-3 text-red-500 flex-shrink-0" />}
              {changeType === 'neutral' && change && <Minus className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />}
              <p className={cn(
                'text-[11px] truncate',
                changeType === 'positive' ? 'text-emerald-600 font-medium' :
                  changeType === 'negative' ? 'text-red-600 font-medium' : 'text-muted-foreground'
              )}>
                {change ?? description}
              </p>
            </div>
          )}
        </div>
        <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted/50', urgent && 'bg-red-100')}>
          <Icon className={cn('h-4.5 w-4.5', urgent ? 'text-red-600' : iconColor)} />
        </div>
      </div>
    </div>
  )
}
