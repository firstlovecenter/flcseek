'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

const LOGO_SRC = '/synago-logo.svg'

/** Branded loader — always spinning synago-logo.svg */
export function SynagoLoader({
  size = 48,
  className,
  label,
  inline = false,
}: {
  size?: number
  className?: string
  label?: string
  /** Compact spinner for buttons and inline actions */
  inline?: boolean
}) {
  const logo = (
    <Image
      src={LOGO_SRC}
      alt=""
      width={size}
      height={size}
      aria-hidden
      className="synago-loader-spin shrink-0 object-contain"
    />
  )

  if (inline) {
    return (
      <span
        className={cn('inline-flex items-center', className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {logo}
        <span className="sr-only">Loading</span>
      </span>
    )
  }

  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {logo}
      {label ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  )
}
