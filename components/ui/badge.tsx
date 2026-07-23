import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-blue-50 text-[#3B82F6] border border-blue-100',
        secondary: 'bg-slate-100 text-slate-600 border border-slate-200',
        destructive: 'bg-red-50 text-red-600 border border-red-100',
        outline: 'border border-slate-200 text-slate-600 bg-white',
        success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
        warning: 'bg-amber-50 text-amber-700 border border-amber-100',
        info: 'bg-blue-50 text-blue-700 border border-blue-100',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
