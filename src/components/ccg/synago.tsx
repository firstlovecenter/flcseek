'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { LEVEL_LABEL, useCcgFocus, type FocusType } from './CcgFocusProvider'

/**
 * Building blocks in the admin portal's (Synago) style: the church-in-focus
 * picker, unit titles and breadcrumbs, detail tiles, avatars and the history
 * timeline.
 */

export const UNIT_LEVEL: Record<Exclude<FocusType, 'global'>, string> = { stream: 'Stream', council: 'Council', ccg: 'CCG', ccf: 'CCF' }
export const groupHref = (type: string, id: string) => `/ccg/groups/${type}/${id}`

/** "CHURCH IN FOCUS" selector (Synago's ChurchRoleScopePicker). */
export function FocusPicker({ className, variant = 'page' }: { className?: string; variant?: 'page' | 'sidebar' }) {
  const { options, focus, setFocus } = useCcgFocus()
  if (options.length === 0) return null
  return (
    <div className={cn('space-y-1.5', className)}>
      <p
        className={cn(
          'flex items-center gap-1.5 text-[11px] tracking-wider uppercase',
          variant === 'sidebar' ? 'font-medium text-sidebar-foreground/55' : 'font-semibold text-primary'
        )}
      >
        <span className={cn('size-1.5 rounded-full', variant === 'sidebar' ? 'bg-sidebar-primary' : 'bg-primary')} aria-hidden />
        Church in focus
      </p>
      <Select value={focus?.key} onValueChange={setFocus}>
        <SelectTrigger
          className={cn(
            'h-11 w-full justify-between text-left font-medium [&>span]:truncate',
            variant === 'sidebar'
              ? 'border-sidebar-primary/40 bg-sidebar-primary/10 text-sidebar-foreground ring-1 ring-sidebar-primary/15 dark:bg-sidebar-primary/15'
              : 'border-primary/50 bg-primary/10 hover:bg-primary/15 focus-visible:ring-primary/30'
          )}
          aria-label="Church in focus"
        >
          <SelectValue placeholder="Choose a unit" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.name} · {LEVEL_LABEL[o.type]} · {o.role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Sticky page header band (breadcrumb, title, actions), as on the portal's detail pages. */
export function StickyHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    // pr-16 on mobile leaves room for the floating navigation toggle.
    <header
      className={cn(
        'sticky -top-4 z-10 -mx-4 -mt-4 border-b border-border bg-background/85 py-3 pr-16 pl-4 backdrop-blur md:-top-6 md:-mx-6 md:-mt-6 md:px-6',
        className
      )}
    >
      {children}
    </header>
  )
}

export function Crumbs({ items }: { items: Array<{ type: string; id: string; name: string }> }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      {items.map((c, i) => (
        <span key={c.id} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden>›</span>}
          <Link href={groupHref(c.type, c.id)} className="transition-colors hover:text-foreground">
            {c.name} {UNIT_LEVEL[c.type as keyof typeof UNIT_LEVEL]}
          </Link>
        </span>
      ))}
    </nav>
  )
}

/** "Harmony" + teal "CCF" (Synago's "MP AlphaMain Bacenta"). */
export function UnitTitle({ name, type, className }: { name: string; type: string; className?: string }) {
  return (
    <h1 className={cn('text-2xl font-bold tracking-tight text-foreground lg:text-3xl', className)}>
      {name} <span className="text-members">{UNIT_LEVEL[type as keyof typeof UNIT_LEVEL] ?? ''}</span>
    </h1>
  )
}

/** A detail tile (portal DetailsCard). */
export function DetailTile({
  heading,
  value,
  href,
  tone,
  loading,
}: {
  heading: string
  value: React.ReactNode
  href?: string
  tone?: 'warning' | 'destructive' | 'success'
  loading?: boolean
}) {
  const body = loading ? (
    <>
      <Skeleton className="mb-2 h-3 w-16" />
      <Skeleton className="h-6 w-24" />
    </>
  ) : (
    <>
      <p className="mb-1 text-xs text-muted-foreground">{heading}</p>
      <p
        className={cn(
          'truncate text-base font-semibold tabular-nums text-foreground',
          tone === 'warning' && 'text-warning',
          tone === 'destructive' && 'text-destructive',
          tone === 'success' && 'text-success'
        )}
      >
        {value}
      </p>
    </>
  )
  const cls = 'block rounded-lg border border-border bg-card p-3 transition-all duration-200'
  return href ? (
    <Link href={href} className={cn(cls, 'hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-muted/50 hover:shadow-sm')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function Initials({ name, className }: { name: string; className?: string }) {
  const parts = name.trim().split(/\s+/)
  const text = `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase()
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-members/15 font-semibold text-members', className ?? 'size-12 text-sm')}
    >
      {text || '?'}
    </span>
  )
}

/** Leader avatar + title + name (portal LeaderAvatar). */
export function LeaderBlock({ title, name, href }: { title: string; name: string | null; href?: string }) {
  const inner = (
    <>
      <Initials name={name ?? '?'} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="truncate text-sm font-semibold text-foreground">{name ?? 'Not assigned yet'}</p>
      </div>
    </>
  )
  return href && name ? (
    <Link href={href} className="flex items-center gap-3 py-3 transition-opacity hover:opacity-80">
      {inner}
    </Link>
  ) : (
    <div className="flex items-center gap-3 py-3">{inner}</div>
  )
}

function relative(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** History timeline (portal Timeline): dot, date, text, time and who did it. */
export function Timeline({ entries }: { entries: Array<{ id: string; text: string; at: string | null; by: string | null }> }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
  return (
    <ol className="relative">
      <span aria-hidden className="absolute top-2 bottom-2 left-[17px] w-[2px] bg-gradient-to-b from-primary/60 via-border to-transparent" />
      {entries.map((e) => (
        <li key={e.id} className="relative flex gap-4 pt-6 first:pt-2">
          <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background shadow-sm">
            <span className="size-2.5 rounded-full bg-primary ring-4 ring-primary/15" />
          </span>
          <div className="min-w-0 flex-1 pb-2">
            {e.at && (
              <time dateTime={e.at} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {relative(e.at)}
              </time>
            )}
            <p className="mt-1.5 text-sm leading-snug font-medium text-foreground">{e.text}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {e.at && new Date(e.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              {e.by && ` · ${e.by}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>
      {action}
    </div>
  )
}
