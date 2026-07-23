import React from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

type PageHeaderProps = {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
  icon?: LucideIcon
  iconColor?: string
  badge?: React.ReactNode
}

export function PageHeader({ title, description, actions, className, icon: Icon, iconColor, badge }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted/60', iconColor)}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
            {badge}
          </div>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">{actions}</div>}
    </div>
  )
}
