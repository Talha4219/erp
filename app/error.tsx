'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-lg font-semibold text-foreground">Something went wrong</p>
        <p className="text-sm text-muted-foreground max-w-md">
          {error.message || 'An unexpected error occurred'}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={reset}>
        <RefreshCw className="mr-2 h-4 w-4" /> Try again
      </Button>
    </div>
  )
}
