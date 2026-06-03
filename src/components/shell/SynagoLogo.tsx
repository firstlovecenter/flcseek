'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

const LOGO_PRIMARY = '/apple-touch-icon.png'
const LOGO_FALLBACK = '/synago-logo.svg'

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
  const [src, setSrc] = useState(LOGO_PRIMARY)

  return (
    // Static public asset — avoid next/image `/_next/image` (breaks under PWA in prod)
    <img
      src={src}
      alt="Seek"
      width={size}
      height={size}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      onError={() => {
        if (src !== LOGO_FALLBACK) setSrc(LOGO_FALLBACK)
      }}
      className={cn('shrink-0 rounded-md object-contain', className)}
    />
  )
}
