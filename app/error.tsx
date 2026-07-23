'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8" style={{ background: 'var(--app-bg)' }}>
      <div className="soft-card rounded-2xl p-8 flex flex-col items-center gap-4 max-w-md">
        <div className="rounded-full bg-red-50 p-3">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-semibold text-slate-800">Something went wrong</p>
          <p className="text-sm text-slate-500 max-w-md">
            {error.message || 'An unexpected error occurred'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="rounded-xl">
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    </div>
  )
}
