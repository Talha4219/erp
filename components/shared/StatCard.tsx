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
  icon: Icon, iconColor = 'text-[#3B82F6]', description, urgent, onClick, accent,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden soft-card soft-card-hover rounded-2xl p-5',
        urgent && 'ring-1 ring-red-200',
        onClick && 'cursor-pointer select-none',
      )}
      onClick={onClick}
    >
      {accent && <div className={cn('absolute inset-x-0 top-0 h-0.5', accent)} />}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 truncate">{title}</p>
          <p className={cn('mt-1.5 text-2xl font-bold leading-none tracking-tight text-slate-800', urgent && 'text-red-500')}>
            {value}
          </p>
          {(change || description) && (
            <div className="mt-2 flex items-center gap-1">
              {changeType === 'positive' && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
              {changeType === 'negative' && <ArrowDownRight className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
              {changeType === 'neutral' && change && <Minus className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />}
              <p className={cn(
                'text-[11px] font-medium truncate',
                changeType === 'positive' ? 'text-emerald-600' :
                  changeType === 'negative' ? 'text-red-500' : 'text-slate-400'
              )}>
                {change ?? description}
              </p>
            </div>
          )}
        </div>
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110',
          urgent ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-[#3B82F6]',
        )}>
          <Icon className={cn('h-5 w-5', !urgent && iconColor)} />
        </div>
      </div>
    </div>
  )
}
