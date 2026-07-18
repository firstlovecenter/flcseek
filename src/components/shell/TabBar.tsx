'use client'

import Link from 'next/link'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  isNavItemActive,
  requestOpenRegister,
  type ShellNavItem,
} from '@/components/shell/mobileNav'

type TabBarProps = {
  items: ShellNavItem[]
  pathname: string
  moreActive?: boolean
  moreOpen?: boolean
  onMoreClick?: () => void
  showMore?: boolean
}

export function TabBar({
  items,
  pathname,
  moreActive = false,
  moreOpen = false,
  onMoreClick,
  showMore = true,
}: TabBarProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-4 z-40 md:hidden"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex h-16 max-w-md items-center rounded-full border border-border/80 bg-card/90 px-2 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.55)] backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon
          const active = isNavItemActive(item, pathname)

          if (item.accent) {
            return (
              <div key={item.id} className="flex min-w-0 flex-1 justify-center">
                {item.href ? (
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    className="flex size-14 -translate-y-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_16px_36px_-16px_hsl(var(--primary))] transition-transform hover:brightness-95 active:scale-95"
                  >
                    <Icon className="size-6" strokeWidth={2.2} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-label={item.label}
                    onClick={() => {
                      if (item.id === 'register') requestOpenRegister()
                    }}
                    className="flex size-14 -translate-y-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_16px_36px_-16px_hsl(var(--primary))] transition-transform hover:brightness-95 active:scale-95"
                  >
                    <Icon className="size-6" strokeWidth={2.2} />
                  </button>
                )}
              </div>
            )
          }

          if (!item.href) return null

          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-full min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-1 rounded-full text-[11px] font-medium transition-colors active:scale-[0.97]',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.2 : 2} />
              <span className="leading-none">{item.label}</span>
            </Link>
          )
        })}

        {showMore && onMoreClick && (
          <button
            type="button"
            aria-label="More"
            aria-expanded={moreOpen}
            onClick={onMoreClick}
            className={cn(
              'flex h-full min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-1 rounded-full text-[11px] font-medium transition-colors active:scale-[0.97]',
              moreActive || moreOpen
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MoreHorizontal className="size-5" strokeWidth={moreActive || moreOpen ? 2.2 : 2} />
            <span className="leading-none">More</span>
          </button>
        )}
      </div>
    </nav>
  )
}
