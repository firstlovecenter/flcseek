'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ccgApi } from '@/lib/ccg/client'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { LEVEL_LABEL, focusQuery, useCcgFocus, type DrillUnit, type FocusType, PORTAL_LABEL } from './CcgFocusProvider'

/**
 * Building blocks in the admin portal's (Synago) style: the church-in-focus
 * picker, unit titles and breadcrumbs, detail tiles, avatars and the history
 * timeline.
 */

export const UNIT_LEVEL: Record<Exclude<FocusType, 'global'>, string> = { campus: 'Campus', stream: 'Stream', council: 'Council', ccg: 'CCG', ccf: 'CCF' }
export const groupHref = (type: string, id: string) => `/ccg/groups/${type}/${id}`

/** "CHURCH IN FOCUS" selector (Synago's ChurchRoleScopePicker): the roles held in the portal in use. */
export function FocusPicker({ className, variant = 'page' }: { className?: string; variant?: 'page' | 'sidebar' }) {
  const { portalOptions: options, focus, setFocus } = useCcgFocus()
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


const LEVEL_PLURAL: Record<DrillUnit['type'], string> = { campus: 'Campuses', stream: 'Streams', council: 'Councils', ccg: 'CCGs', ccf: 'CCFs' }
const SHOWN = 8

/**
 * Drill-down on the page, as in the admin portal: a breadcrumb from the church
 * in focus down to the unit open now, and the units below it as cards. Opening
 * one keeps the role and shows this same page for that unit (campus → stream →
 * council → CCG → CCF; Sheep Seeking stops at streams). Nothing shows for a
 * role with nothing below it.
 */
export function UnitDrill({ className, units = true }: { className?: string; /** Off: the breadcrumb only. */ units?: boolean }) {
  const { focus, roleFocus, portal, drillPath, drillTo, drillBack } = useCcgFocus()
  const [children, setChildren] = useState<DrillUnit[] | null>(null)
  const [all, setAll] = useState(false)
  const [filter, setFilter] = useState('')
  const q = focusQuery(focus)

  useEffect(() => {
    setAll(false)
    setFilter('')
    if (!units || !portal || focus?.type === 'ccf') return setChildren([])
    setChildren(null)
    let live = true
    ccgApi.get<{ items: DrillUnit[] }>(`/units/children?portal=${portal}${q ? `&${q}` : ''}`).then((r) => {
      if (!live) return
      if (r.ok) setChildren(r.data.items)
      else if (drillPath.length) drillBack(-1) // a unit opened earlier is gone or out of reach
      else setChildren([])
    })
    return () => {
      live = false
    }
    // Refetch when the unit changes, not when the drill helpers do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, portal, q])

  if (!roleFocus || !focus) return null
  const crumbs: Array<{ name: string; type: FocusType; index: number }> = [
    { name: roleFocus.name, type: roleFocus.type, index: -1 },
    ...drillPath.map((u, i) => ({ name: u.name, type: u.type, index: i })),
  ]
  const types = [...new Set((children ?? []).map((c) => c.type))]
  const heading = `${types.map((t) => LEVEL_PLURAL[t]).join(' and ')} in ${focus.name}`
  const matching = (children ?? []).filter((c) => !filter || c.name.toLowerCase().includes(filter.toLowerCase()))
  const shown = all || filter ? matching : matching.slice(0, SHOWN)
  if (drillPath.length === 0 && !children?.length) return null

  return (
    <section className={cn('space-y-3', className)} aria-label="Units">
      {drillPath.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => drillBack(drillPath.length - 2)}
            className="-ml-1.5 inline-flex min-h-8 items-center gap-0.5 rounded-md px-1.5 font-medium hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Back
          </button>
          {crumbs.map((c, i) => (
            <span key={`${c.type}:${c.index}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
              {i === crumbs.length - 1 ? (
                <span className="truncate font-medium text-foreground" aria-current="page">
                  {c.name} <span className="text-members">{LEVEL_LABEL[c.type]}</span>
                </span>
              ) : (
                <button type="button" onClick={() => drillBack(c.index)} className="truncate underline-offset-2 hover:text-foreground hover:underline">
                  {c.name}
                </button>
              )}
            </span>
          ))}
        </nav>
      )}
      {children === null && units && focus.type !== 'ccf' ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        !!children?.length && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {heading} <span className="tabular-nums">· {children.length}</span>
              </p>
              {children.length > SHOWN * 1.5 && (
                <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find…" aria-label={`Find in ${heading}`} className="h-9 w-44" />
              )}
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {shown.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => drillTo(c)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:border-foreground/20 hover:bg-muted/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">{LEVEL_LABEL[c.type]}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
            {!filter && matching.length > SHOWN && (
              <button type="button" onClick={() => setAll((a) => !a)} className="min-h-8 text-sm font-medium text-primary hover:underline">
                {all ? 'Show fewer' : `Show all ${matching.length}`}
              </button>
            )}
            {filter && matching.length === 0 && <p className="text-sm text-muted-foreground">Nothing matches “{filter}”.</p>}
          </div>
        )
      )}
    </section>
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

/** Moves between the Sheep Seeking and City Church Groups portals (shown only to people with roles in both). */
export function PortalSwitcher({ className, variant = 'page' }: { className?: string; variant?: 'page' | 'sidebar' }) {
  const { portals, portal, setPortal } = useCcgFocus()
  if (portals.length < 2) return null
  return (
    <div role="group" aria-label="Portal" className={cn('grid grid-cols-2 gap-1 rounded-lg border p-1', variant === 'sidebar' ? 'border-sidebar-border' : 'border-border', className)}>
      {portals.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={portal === p}
          onClick={() => setPortal(p)}
          className={cn(
            'min-h-9 rounded-md px-2 text-xs leading-tight font-semibold transition-colors',
            portal === p
              ? variant === 'sidebar'
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'bg-primary text-primary-foreground'
              : variant === 'sidebar'
                ? 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          {PORTAL_LABEL[p]}
        </button>
      ))}
    </div>
  )
}
