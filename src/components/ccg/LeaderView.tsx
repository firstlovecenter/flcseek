'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, Calendar, ChevronDown, ChevronRight, Home, LineChart, Network, Users, type LucideIcon } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/base/EmptyState'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { useCcgFocus } from './CcgFocusProvider'
import type { MilestoneDef, ProgressRow } from './progress-types'
import { UNIT_LEVEL } from './synago'

/**
 * Campus Leaders and Stream Leaders (Overseers) get Seek's Lead Pastor screens,
 * as they were: "Select A Group" (here a month, then — a Campus Leader — a
 * stream), then the group's pages: Milestones, Attendance and Reports, read
 * only. A month is the converts registered in it.
 */

export type LeadUnitType = 'stream' | 'ccg'

const MONTH_KEY = 'ccg.leader-month'
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/** The month in use, remembered for this browser session so the sidebar's CCG links keep it. */
export function rememberMonth(month: string) {
  try {
    window.sessionStorage.setItem(MONTH_KEY, month)
  } catch {
    // storage unavailable: the month is asked for again
  }
}

export function rememberedMonth(): string | null {
  try {
    const m = window.sessionStorage.getItem(MONTH_KEY)
    return m && MONTH_RE.test(m) ? m : null
  } catch {
    return null
  }
}

/** The ?month= in the URL, when valid. */
export function useMonthParam(): string | null {
  const m = useSearchParams().get('month')
  return m && MONTH_RE.test(m) ? m : null
}

export function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const monthName = (month: string) => monthLabel(month).split(' ')[0]
const unitQuery = (type: string, id: string) => `unit_type=${type}&unit_id=${id}`

/** Seek's page header band ("Select A Group"). */
function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="-mx-4 -mt-4 border-b bg-card px-6 py-4 md:-mx-6 md:-mt-6">
      <div className="mx-auto flex max-w-6xl items-center gap-3 pr-12 md:pr-0">
        <Home className="size-6 text-foreground" />
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

/** Seek's group card: icon, name and year, then a count and the leader. */
function SelectCard({
  icon: Icon = Calendar,
  title,
  caption,
  count,
  leader,
  onSelect,
}: {
  icon?: LucideIcon
  title: string
  caption: string
  count: string
  leader?: string | null
  onSelect: () => void
}) {
  return (
    <Card className="cursor-pointer transition-all hover:border-primary/40" onClick={onSelect}>
      <CardContent className="p-4">
        <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={onSelect}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{caption}</p>
            </div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-primary" />
        </button>
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" />
            {count}
          </span>
          {leader && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {leader.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{leader}</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const converts = (n: number) => `${n} ${n === 1 ? 'convert' : 'converts'}`

function YearSection({ year, count, children }: { year: number; count: number; children: React.ReactNode }) {
  const current = year === new Date().getFullYear()
  const [open, setOpen] = useState(current)
  return (
    <div className="mb-4 overflow-hidden rounded-lg border bg-card">
      <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => setOpen((v) => !v)}>
        <ChevronDown className={cn('size-5 transition-transform', !open && '-rotate-90')} />
        <Calendar className="size-5 text-primary" />
        <span className="text-lg font-semibold">{year}</span>
        <Badge variant={current ? 'default' : 'secondary'}>
          {count} {count === 1 ? 'month' : 'months'}
        </Badge>
        {current && (
          <Badge variant="outline" className="border-success/40 text-success">
            Current Year
          </Badge>
        )}
      </button>
      {open && <div className="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>}
    </div>
  )
}

/** Step one: the month, in year sections (newest first), the current year open. */
export function MonthPicker({ unit, onPick }: { unit: { type: 'campus' | LeadUnitType; id: string }; onPick: (month: string) => void }) {
  const [months, setMonths] = useState<Array<{ month: string; converts: number }> | null>(null)
  useEffect(() => {
    ccgApi.get<{ months: Array<{ month: string; converts: number }> }>(`/months?${unitQuery(unit.type, unit.id)}`).then((r) => setMonths(r.ok ? r.data.months : []))
  }, [unit.type, unit.id])
  if (!months) return <LoadingScreen label="Loading months…" />
  const years = [...new Set(months.map((m) => Number(m.month.slice(0, 4))))].sort((a, b) => b - a)
  return (
    <div className="min-h-full">
      <PageHeader title="Select A Month" subtitle="Choose a month to view milestone tracking and attendance" />
      <div className="px-0 py-8 sm:px-2">
        {years.length === 0 ? (
          <EmptyState title="No converts found" />
        ) : (
          years.map((y) => {
            const inYear = months.filter((m) => m.month.startsWith(`${y}-`)).sort((a, b) => a.month.localeCompare(b.month))
            return (
              <YearSection key={y} year={y} count={inYear.length}>
                {inYear.map((m) => (
                  <SelectCard key={m.month} title={monthName(m.month)} caption={String(y)} count={converts(m.converts)} onSelect={() => onPick(m.month)} />
                ))}
              </YearSection>
            )
          })
        )}
      </div>
    </div>
  )
}

/** A Campus Leader's step two: the campus's streams, with the month's converts in each. */
export function StreamPicker({ campusId, month, onPick }: { campusId: string; month: string; onPick: (streamId: string) => void }) {
  const [items, setItems] = useState<Array<{ id: string; name: string; leader: string | null; converts: number }> | null>(null)
  useEffect(() => {
    ;(async () => {
      const r = await ccgApi.get<{ children: { items: Array<{ id: string; name: string; status: string; leader: string | null }> } | null }>(
        `/groups/campus/${campusId}?history=1`
      )
      const streams = r.ok ? (r.data.children?.items ?? []).filter((s) => s.status === 'active') : []
      const counts = await Promise.all(
        streams.map((s) =>
          ccgApi.get<{ months: Array<{ month: string; converts: number }> }>(`/months?${unitQuery('stream', s.id)}`).then((m) => (m.ok ? m.data.months.find((x) => x.month === month)?.converts ?? 0 : 0))
        )
      )
      setItems(streams.map((s, i) => ({ id: s.id, name: s.name, leader: s.leader, converts: counts[i] })))
    })()
  }, [campusId, month])
  if (!items) return <LoadingScreen label="Loading streams…" />
  return (
    <div className="min-h-full">
      <PageHeader title="Select A Stream" subtitle={`${monthLabel(month)} · choose a stream to view milestone tracking and attendance`} />
      <div className="px-0 py-8 sm:px-2">
        {items.length === 0 ? (
          <EmptyState title="No streams found" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((s) => (
              <SelectCard key={s.id} icon={Network} title={s.name} caption={monthLabel(month)} count={converts(s.converts)} leader={s.leader} onSelect={() => onPick(s.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export type LeadTab = 'milestones' | 'attendance' | 'reports'

/** Seek's group buttons for a Lead Pastor: Home, Milestones, Attendance, Reports. */
export function LeadNavActions({ type, id, month, active, className }: { type: LeadUnitType; id: string; month: string; active: LeadTab; className?: string }) {
  const router = useRouter()
  const base = `/ccg/lead/${type}/${id}`
  const go = (path: string) => router.push(`${base}${path}?month=${month}`)
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button variant="outline" size="sm" onClick={() => router.push('/ccg')}>
        <Home className="size-4" />
        Home
      </Button>
      <Button variant={active === 'milestones' ? 'default' : 'outline'} size="sm" onClick={() => go('')}>
        <BarChart3 className="size-4" />
        Milestones
      </Button>
      <Button variant={active === 'attendance' ? 'default' : 'outline'} size="sm" onClick={() => go('/attendance')}>
        <Users className="size-4" />
        Attendance
      </Button>
      <Button variant={active === 'reports' ? 'default' : 'outline'} size="sm" onClick={() => go('/reports')}>
        <LineChart className="size-4" />
        Reports
      </Button>
    </div>
  )
}

/** Seek's header pill ("January 2026 · Lead Pastor"), naming the stream or CCG. */
export function ContextPill({ name, type, month }: { name: string | null; type: LeadUnitType; month: string }) {
  const { focus } = useCcgFocus()
  return (
    <span className="inline-block max-w-full truncate rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
      {[name ? `${name} ${UNIT_LEVEL[type]}` : null, monthLabel(month), focus?.role].filter(Boolean).join(' · ')}
    </span>
  )
}

/**
 * The month for a stream or CCG page: the link's, else the one chosen earlier
 * this session, else the month picker. `children` renders with it.
 */
export function WithMonth({ type, id, children }: { type: LeadUnitType; id: string; children: (month: string) => React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const fromUrl = useMonthParam()
  const [saved, setSaved] = useState<string | null | undefined>(undefined)
  useEffect(() => setSaved(rememberedMonth()), [])
  const month = fromUrl ?? saved
  useEffect(() => {
    if (month) rememberMonth(month)
  }, [month])
  if (month === undefined) return <LoadingScreen />
  if (!month) return <MonthPicker unit={{ type, id }} onPick={(m) => router.replace(`${pathname}?month=${m}`)} />
  return <>{children(month)}</>
}

/** The unit's name, for the header pill. */
export function useUnitName(type: LeadUnitType, id: string) {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    ccgApi.get<{ unit: { name: string } }>(`/groups/${type}/${id}?history=1`).then((r) => r.ok && setName(r.data.unit.name))
  }, [type, id])
  return name
}

/** The month's converts in a stream or CCG, against the milestones. */
export function useLeadProgress(type: LeadUnitType, id: string, month: string) {
  const [data, setData] = useState<{ milestones: MilestoneDef[]; rows: ProgressRow[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    const r = await ccgApi.get<{ milestones: MilestoneDef[]; rows: ProgressRow[] }>(`/progress?${type}_id=${id}&month=${month}`)
    if (r.ok) {
      setError(null)
      setData(r.data)
    } else setError(r.error.message)
  }, [type, id, month])
  useEffect(() => {
    setData(null)
    load()
  }, [load])
  return { data, error, reload: load }
}

/**
 * Sunday attendance against the goal, as Seek counted it: the Sunday service
 * milestone's count and target.
 */
export function sundayAttendance(row: ProgressRow, milestones: MilestoneDef[]) {
  const m = milestones.find((x) => x.kind === 'attendance' && x.attendance_event === 'sunday_service')
  const goal = m?.attendance_target ?? 0
  const count = m ? Math.min(row.stages.find((s) => s.stage_number === m.stage_number)?.progress?.done ?? 0, goal || Infinity) : 0
  return { count, goal, percentage: goal ? Math.min(Math.round((count / goal) * 100), 100) : 0 }
}
