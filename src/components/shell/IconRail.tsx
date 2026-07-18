'use client'

import Link from 'next/link'
import { LogOut, MoreHorizontal } from 'lucide-react'
import { SynagoLogo } from '@/components/shell/SynagoLogo'
import { cn } from '@/lib/utils'
import {
  isNavItemActive,
  type ShellNavItem,
} from '@/components/shell/mobileNav'

type IconRailProps = {
  items: ShellNavItem[]
  pathname: string
  moreActive?: boolean
  moreOpen?: boolean
  onMoreClick?: () => void
  onLogout?: () => void
  homeHref?: string
}

export function IconRail({
  items,
  pathname,
  moreActive = false,
  moreOpen = false,
  onMoreClick,
  onLogout,
  homeHref = '/superadmin',
}: IconRailProps) {
  return (
    <aside
      aria-label="Primary"
      className="hidden h-screen w-[84px] shrink-0 flex-col items-center border-r border-border bg-card py-5 md:flex"
    >
      <Link
        href={homeHref}
        aria-label="Seek home"
        className="mb-8 flex items-center justify-center"
      >
        <SynagoLogo size={36} surface="auto" />
      </Link>

      <nav className="flex flex-col items-center gap-1.5">
        {items.map((item) => {
          const Icon = item.icon
          const active = isNavItemActive(item, pathname)
          if (!item.href) return null

          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              title={item.label}
              className={cn(
                'flex w-16 flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[11px] font-medium transition-colors active:scale-[0.97]',
                active
                  ? 'bg-primary/12 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.2 : 2} />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {onMoreClick && (
          <button
            type="button"
            aria-label="More"
            aria-expanded={moreOpen}
            title="More"
            onClick={onMoreClick}
            className={cn(
              'flex w-16 flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[11px] font-medium transition-colors active:scale-[0.97]',
              moreActive || moreOpen
                ? 'bg-primary/12 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <MoreHorizontal
              className="size-5"
              strokeWidth={moreActive || moreOpen ? 2.2 : 2}
            />
            <span>More</span>
          </button>
        )}
      </nav>

      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          aria-label="Log out"
          title="Log out"
          className="mt-auto flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-[0.97]"
        >
          <LogOut className="size-5" />
        </button>
      )}
    </aside>
  )
}
