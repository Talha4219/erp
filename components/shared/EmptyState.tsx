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
      <div className={cn('rounded-xl bg-muted/50 p-4', iconColor ? '' : '')}>
        <Icon className={cn('h-8 w-8', iconColor ?? 'text-muted-foreground/40')} />
      </div>
      <div className="space-y-1 max-w-xs">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      {action}
    </div>
  )
}
