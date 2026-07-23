'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Clock } from 'lucide-react'

type Step = {
  status: string
  label: string
  timestamp?: string | null
  active?: boolean
}

type Props = {
  steps: Step[]
  currentStatus: string
  className?: string
}

export function StatusTimeline({ steps, currentStatus, className }: Props) {
  const currentIdx = steps.findIndex((s) => s.status === currentStatus)

  return (
    <div className={cn('space-y-0', className)}>
      {steps.map((step, i) => {
        const isComplete = i < currentIdx
        const isCurrent = i === currentIdx
        const isFuture = i > currentIdx

        return (
          <div key={step.status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                isComplete ? 'border-emerald-500 bg-emerald-50' :
                  isCurrent ? 'border-indigo-500 bg-indigo-50' :
                    'border-gray-200 bg-gray-50'
              )}>
                {isComplete ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : isCurrent ? (
                  <Clock className="h-3.5 w-3.5 text-indigo-600" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-gray-300" />
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={cn(
                  'h-full w-0.5',
                  isComplete ? 'bg-emerald-200' : 'bg-gray-200'
                )} />
              )}
            </div>
            <div className={cn('pb-6', isFuture && 'opacity-40')}>
              <p className={cn(
                'text-sm font-medium',
                isComplete ? 'text-emerald-700' :
                  isCurrent ? 'text-indigo-700' : 'text-gray-500'
              )}>
                {step.label}
              </p>
              {step.timestamp && (
                <p className="text-xs text-gray-400 mt-0.5">{step.timestamp}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
