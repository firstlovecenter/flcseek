'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

const LOGO_SRC = '/apple-touch-icon.png'

/** App logo (header, sidebar, auth). Spinner uses SynagoLoader + synago-logo.svg. */
export type LogoSurface = 'auto' | 'dark' | 'light'

export function SynagoLogo({
  size = 28,
  surface: _surface = 'auto',
  className,
  priority,
}: {
  size?: number
  /** @deprecated Kept for call-site compatibility; logo asset is always apple-touch-icon.png */
  surface?: LogoSurface
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src={LOGO_SRC}
      alt="Seek"
      width={size}
      height={size}
      priority={priority}
      className={cn('shrink-0 rounded-md object-contain', className)}
    />
  )
}
