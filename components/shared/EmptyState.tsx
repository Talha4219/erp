import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  iconColor?: string
}

export function EmptyState({ icon: Icon, title, description, action, className, iconColor }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}>
      <div className="rounded-xl bg-slate-50 p-4">
        <Icon className={cn('h-8 w-8', iconColor ?? 'text-slate-300')} />
      </div>
      <div className="space-y-1 max-w-xs">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {description && <p className="text-xs text-slate-400 leading-relaxed">{description}</p>}
      </div>
      {action}
    </div>
  )
}
