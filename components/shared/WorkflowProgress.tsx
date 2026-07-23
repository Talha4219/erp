import { cn } from '@/lib/utils'
import { Check, Circle } from 'lucide-react'

type WorkflowStep = {
  label: string
  done: boolean
  active?: boolean
  skipped?: boolean
}

type WorkflowProgressProps = {
  steps: WorkflowStep[]
  className?: string
  compact?: boolean
}

export function WorkflowProgress({ steps, className, compact }: WorkflowProgressProps) {
  return (
    <div className={cn('flex items-center gap-0', className)}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1
        return (
          <div key={step.label} className="flex items-center flex-1 min-w-0">
            {/* Node */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={cn(
                  'flex items-center justify-center rounded-full border-2 transition-all',
                  compact ? 'h-5 w-5' : 'h-7 w-7',
                  step.done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : step.active
                    ? 'border-[#3B82F6] bg-blue-50 text-[#3B82F6]'
                    : step.skipped
                    ? 'border-slate-200 bg-slate-50 text-slate-400'
                    : 'border-slate-200 bg-white text-slate-300'
                )}
              >
                {step.done ? (
                  <Check className={cn(compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5')} />
                ) : (
                  <Circle className={cn(compact ? 'h-2 w-2' : 'h-3 w-3', 'fill-current')} />
                )}
              </div>
              {!compact && (
                <span className={cn(
                  'mt-1 text-center text-[10px] leading-tight max-w-[60px] whitespace-normal break-words',
                  step.done ? 'text-emerald-600 font-medium' :
                    step.active ? 'text-[#3B82F6] font-semibold' : 'text-slate-400'
                )}>
                  {step.label}
                </span>
              )}
            </div>

            {/* Connector */}
            {!isLast && (
              <div className={cn(
                'flex-1 h-0.5 mx-1 transition-all',
                step.done ? 'bg-emerald-400' : 'bg-gray-200'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
