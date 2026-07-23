'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShieldOff, ArrowLeft, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function UnauthorizedPage() {
  const router = useRouter()
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 text-center px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
        <ShieldOff className="h-10 w-10 text-red-500" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
        <p className="text-muted-foreground max-w-sm">
          You don&apos;t have permission to view this page. Contact your administrator if you think this is a mistake.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />Go Back
        </Button>
        <Button asChild>
          <Link href="/dashboard">
            <Home className="mr-2 h-4 w-4" />Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}
