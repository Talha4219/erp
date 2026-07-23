'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ErrorBannerProps = {
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorBanner({ message = 'Failed to load data', onRetry, className }: ErrorBannerProps) {
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950',
      className,
    )}>
      <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
      <p className="flex-1 text-sm font-medium text-red-800 dark:text-red-200">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300">
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  )
}
