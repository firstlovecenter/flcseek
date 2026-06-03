'use client'

import { SynagoLoader } from '@/components/shell/SynagoLoader'
import { cn } from '@/lib/utils'

export function LoadingScreen({
  className,
  label = 'Loading…',
  fullScreen = false,
}: {
  className?: string
  label?: string
  /** Use for auth gates and route-level loading (100dvh) */
  fullScreen?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-background p-8',
        fullScreen ? 'min-h-[100dvh]' : 'min-h-[50vh]',
        className
      )}
    >
      <SynagoLoader size={56} label={label} />
    </div>
  )
}
