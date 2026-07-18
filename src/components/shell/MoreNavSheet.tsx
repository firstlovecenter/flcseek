'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  isNavItemActive,
  type ShellNavItem,
} from '@/components/shell/mobileNav'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type MoreNavSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ShellNavItem[]
  pathname: string
  title?: string
  /** Offset for desktop rail so sheet sits beside it */
  desktopBesideRail?: boolean
}

export function MoreNavSheet({
  open,
  onOpenChange,
  items,
  pathname,
  title = 'More',
  desktopBesideRail = false,
}: MoreNavSheetProps) {
  if (items.length === 0) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          'mx-auto max-h-[85dvh] gap-0 rounded-t-[28px] border border-b-0 p-0 sm:max-w-md',
          desktopBesideRail &&
            'md:inset-y-4 md:right-auto md:bottom-auto md:left-[96px] md:mx-0 md:h-auto md:max-h-[calc(100dvh-2rem)] md:w-80 md:max-w-none md:rounded-3xl md:border'
        )}
        style={{
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
      >
        <SheetHeader className="flex flex-row items-center justify-between space-y-0 px-4 pt-4 pb-2">
          <SheetTitle>{title}</SheetTitle>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </SheetHeader>

        <div className="grid gap-1 px-3 pb-3">
          {items.map((item) => {
            if (!item.href) return null
            const Icon = item.icon
            const active = isNavItemActive(item, pathname)
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/12 text-primary'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
