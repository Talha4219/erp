'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const CollapsibleContext = React.createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => {},
})

function Collapsible({ open: controlledOpen, onOpenChange, defaultOpen = false, children, className }: {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const open = controlledOpen ?? internalOpen
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v)
    else setInternalOpen(v)
  }
  return (
    <CollapsibleContext.Provider value={{ open, setOpen }}>
      <div className={cn(className)}>{children}</div>
    </CollapsibleContext.Provider>
  )
}

function CollapsibleTrigger({ children, asChild, className, ...props }: {
  children: React.ReactNode
  asChild?: boolean
  className?: string
} & React.HTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen } = React.useContext(CollapsibleContext)
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void; className?: string }>, {
      onClick: () => setOpen(!open),
      className: cn((children as React.ReactElement<{ className?: string }>).props.className, className),
    })
  }
  return (
    <button type="button" onClick={() => setOpen(!open)} className={cn(className)} {...props}>
      {children}
    </button>
  )
}

function CollapsibleContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = React.useContext(CollapsibleContext)
  if (!open) return null
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
