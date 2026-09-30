'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Calendar, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/base/EmptyState'
import { ConvertMilestones } from './ConvertMilestones'
import { GroupCard, GROUP_PLURAL, type GroupCardItem } from './GroupCard'
import { DashboardNumbers, WeeklyTrend, type Dashboard } from './UnitReport'
import { StickyHeader, UnitTitle, UNIT_LEVEL } from './synago'

/**
 * Campus Leaders and Stream Leaders (Overseers) work like Seek's Lead Pastor:
 * choose a month (the converts of that month, as Seek's monthly groups), then
 * — a Campus Leader — a stream, and see its converts' milestones board, with
 * the dashboard beside it. A Stream Leader goes from the month straight to
 * their stream's board, and opens one CCG from the sidebar. All read only.
 */

export type LeaderUnitType = 'campus' | 'stream' | 'ccg'

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

function useMonths(type: LeaderUnitType, id: string) {
  const [months, setMonths] = useState<Array<{ month: string; converts: number }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setMonths(null)
    ccgApi.get<{ months: Array<{ month: string; converts: number }> }>(`/months?${unitQuery(type, id)}`).then((r) => (r.ok ? setMonths(r.data.months) : setError(r.error.message)))
  }, [type, id])
  return { months, error }
}

/** Seek's "Select A Group": months in year sections, the current year open. */
export function MonthPicker({ unit, onPick }: { unit: { type: LeaderUnitType; id: string; name?: string }; onPick: (month: string) => void }) {
  const { months, error } = useMonths(unit.type, unit.id)
  const thisYear = new Date().getFullYear()
  const years = [...new Set((months ?? []).map((m) => Number(m.month.slice(0, 4))))]

  return (
    <div className="space-y-5 pt-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="size-6 text-foreground" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">Select a month</h2>
          <p className="text-xs text-muted-foreground">
            {unit.name ? `${unit.name} ${UNIT_LEVEL[unit.type]} · ` : ''}Choose a month to follow its converts’ milestones
          </p>
        </div>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !months ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : months.length === 0 ? (
        <EmptyState icon={Calendar} title="No converts yet" description="Months appear here once converts are placed in a CCF." />
      ) : (
        years.map((y) => (
          <YearSection key={y} year={y} current={y === thisYear} defaultOpen={y === (years.includes(thisYear) ? thisYear : years[0])}>
            {months
              .filter((m) => m.month.startsWith(`${y}-`))
              .sort((a, b) => a.month.localeCompare(b.month))
              .map((m) => (
                <button
                  key={m.month}
                  type="button"
                  onClick={() => onPick(m.month)}
                  className="group flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Calendar className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-foreground">{monthName(m.month)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {m.converts} {m.converts === 1 ? 'convert' : 'converts'}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />
                </button>
              ))}
          </YearSection>
        ))
      )}
    </div>
  )
}

function YearSection({ year, current, defaultOpen, children }: { year: number; current: boolean; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown className={cn('size-5 transition-transform', !open && '-rotate-90')} aria-hidden />
        <span className="text-lg font-semibold">{year}</span>
        {current && (
          <Badge variant="outline" className="border-success/40 text-success">
            Current year
          </Badge>
        )}
      </button>
      {open && <div className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>}
    </div>
  )
}

/** A Campus Leader's second step: the campus's streams, with that month's converts in each. */
export function StreamPicker({ campus, month, onChangeMonth }: { campus: { id: string; name: string }; month: string; onChangeMonth: () => void }) {
  const [items, setItems] = useState<GroupCardItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setItems(null)
    ;(async () => {
      const r = await ccgApi.get<{ children: { items: GroupCardItem[] } | null }>(`/groups/campus/${campus.id}?history=1`)
      if (!r.ok) return setError(r.error.message)
      const streams = r.data.children?.items ?? []
      // Each card counts the chosen month's converts, not every convert.
      const counts = await Promise.all(
        streams.map((s) =>
          ccgApi.get<{ months: Array<{ month: string; converts: number }> }>(`/months?${unitQuery('stream', s.id)}`).then((m) => (m.ok ? m.data.months.find((x) => x.month === month)?.converts ?? 0 : s.placed))
        )
      )
      setItems(streams.map((s, i) => ({ ...s, placed: counts[i] })))
    })()
  }, [campus.id, month])

  return (
    <div className="space-y-5 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="size-6 text-foreground" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold">Select a stream</h2>
            <p className="text-xs text-muted-foreground">
              {campus.name} Campus · {monthLabel(month)} converts
            </p>
          </div>
        </div>
        <Button variant="outline" className="h-10" onClick={onChangeMonth}>
          Change month
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !items ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No {GROUP_PLURAL.stream} yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <GroupCard key={s.id} type="stream" item={s} href={`/ccg/lead/stream/${s.id}?month=${month}`} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * One stream or CCG for one month: the milestones board (each convert's
 * progress) first, the dashboard in the next tab.
 */
export function LeaderUnitView({
  type,
  id,
  month,
  back,
  changeMonthHref,
  embedded = false,
}: {
  type: 'stream' | 'ccg'
  id: string
  month: string
  back?: { href: string; label: string }
  changeMonthHref: string
  /** Inside another page (Home), under its own header: no sticky header band. */
  embedded?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tab = params.get('tab') === 'dashboard' ? 'dashboard' : 'milestones'
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    rememberMonth(month)
  }, [month])

  useEffect(() => {
    setName(null)
    ccgApi.get<{ unit: { name: string } }>(`/groups/${type}/${id}?history=1`).then((r) => r.ok && setName(r.data.unit.name))
  }, [type, id])

  const setTab = (t: string) => {
    const next = new URLSearchParams(params.toString())
    if (t === 'dashboard') next.set('tab', t)
    else next.delete('tab')
    router.replace(`${pathname}?${next}`, { scroll: false })
  }

  const Header = embedded ? 'div' : StickyHeader
  return (
    <div className="pb-10">
      <Header className="space-y-1">
        {back && (
          <Link href={back.href} className="text-xs text-muted-foreground hover:text-foreground">
            ‹ {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {name ? <UnitTitle name={name} type={type} className="truncate" /> : <Skeleton className="h-8 w-56" />}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs">
              <Calendar className="size-3.5" aria-hidden />
              {monthLabel(month)}
            </Badge>
            <Button variant="outline" size="sm" className="h-9" asChild>
              <Link href={changeMonthHref}>Change month</Link>
            </Button>
          </div>
        </div>
      </Header>
      <Tabs value={tab} onValueChange={setTab} className="pt-4">
        <TabsList>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>
        <TabsContent value="milestones">
          <ConvertMilestones unit={{ type, id }} month={month} />
        </TabsContent>
        <TabsContent value="dashboard">
          <UnitDashboard type={type} id={id} month={month} name={name} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function UnitDashboard({ type, id, month, name }: { type: 'stream' | 'ccg'; id: string; month: string; name: string | null }) {
  const [d, setD] = useState<Dashboard | null>(null)
  const q = `${unitQuery(type, id)}&month=${month}`
  useEffect(() => {
    setD(null)
    ccgApi.get<Dashboard>(`/dashboard?${q}`).then((r) => r.ok && setD(r.data))
  }, [q])
  const overdue = d?.placements.milestones_overdue ?? 0
  return (
    <div className="space-y-6 py-4">
      <DashboardNumbers
        loading={!d}
        primary={{ label: `${monthLabel(month)} converts`, value: d?.placements.active ?? 0 }}
        secondaries={[
          { label: 'Milestones overdue', value: overdue, warn: overdue > 0 },
          { label: 'Need follow-up', value: d?.placements.follow_ups ?? 0, warn: (d?.placements.follow_ups ?? 0) > 0 },
          { label: 'Year complete', value: d?.placements.assessments?.complete ?? 0 },
          { label: `Members in ${UNIT_LEVEL[type]}`, value: d?.units.members ?? 0 },
        ]}
      />
      <WeeklyTrend q={q} subtitle={`${name ?? UNIT_LEVEL[type]} · ${monthLabel(month)} converts`} />
    </div>
  )
}
