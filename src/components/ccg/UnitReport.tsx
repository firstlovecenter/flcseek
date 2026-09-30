'use client'

import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis } from 'recharts'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The report pieces shared by Home and a leader's unit page: the headline
 * numbers and the weekly attendance trend.
 */

export interface Dashboard {
  units: { active_ccfs: number; open_spaces: number; members: number }
  queue: { proposed: number; held: number; oldest_proposal_days: number | null } | null
  converts_waiting: number | null
  members_pending_confirmation: number
  placements: {
    active: number
    milestones_overdue: number
    follow_ups: number
    assessments?: { in_progress: number; complete: number; ended_incomplete: number }
  }
  week: {
    week: number
    schedule: string | null
    tasks: Array<{ key: string; label: string; state: 'done' | 'due' | 'upcoming'; detail: string | null; href: string }>
  }
}

interface Trend {
  series: 'sunday' | 'fellowship'
  range: string
  weeks: Array<{ label: string; sunday: number; in_person: number; online: number }>
}

/** One big number and two smaller ones beneath it. */
export function DashboardNumbers({
  loading,
  primary,
  secondaries,
}: {
  loading: boolean
  primary: { label: string; value: number }
  secondaries: Array<{ label: string; value: number; warn?: boolean }>
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-stretch">
        <div className={cn('w-1 shrink-0 rounded-l-2xl bg-primary', !primary.value && !loading && 'opacity-30')} />
        <div className="flex-1 px-6 py-5">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{primary.label}</p>
          {loading ? (
            <Skeleton className="mt-3 h-12 w-32" />
          ) : (
            <p className="mt-1.5 text-5xl font-semibold tracking-tighter tabular-nums text-foreground">{primary.value}</p>
          )}
        </div>
      </div>
      <Separator />
      <div className={cn('grid divide-x divide-border', secondaries.length > 2 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2')}>
        {secondaries.map((s) => (
          <div key={s.label} className="px-6 py-4">
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{s.label}</p>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-20" />
            ) : (
              <p className={cn('mt-1 text-2xl font-semibold tracking-tight tabular-nums', s.warn ? 'text-warning' : 'text-foreground')}>{s.value}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/** Sunday service or fellowship attendance of placed converts, week by week. `q` is the unit's query string. */
export function WeeklyTrend({ q, subtitle }: { q: string; subtitle: string }) {
  const [series, setSeries] = useState<'sunday' | 'fellowship'>('sunday')
  const [page, setPage] = useState(0)
  const [trend, setTrend] = useState<Trend | null>(null)

  useEffect(() => {
    setTrend(null)
    ccgApi.get<Trend>(`/trends?series=${series}&offset=${page}${q ? `&${q}` : ''}`).then((r) => r.ok && setTrend(r.data))
  }, [q, series, page])

  const chartData = trend?.weeks ?? []
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-medium text-foreground">Weekly trend</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle} · placed converts</p>
          <div className="mt-3 inline-flex w-full max-w-sm rounded-lg border border-border p-1 sm:w-auto" role="group" aria-label="Which meetings">
            {(['sunday', 'fellowship'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSeries(s)
                  setPage(0)
                }}
                aria-pressed={series === s}
                className={cn(
                  'min-h-11 flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none',
                  series === s ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {s === 'sunday' ? 'Sunday service' : 'Fellowship'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:justify-end">
          {series === 'sunday' ? (
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-destructive" />
              Sunday attendance
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-arrivals" />
                In person
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-members" />
                Online
              </span>
            </>
          )}
        </div>
      </div>
      <div className="mt-6 h-64">
        {!trend ? (
          <Skeleton className="h-full w-full rounded-xl" />
        ) : chartData.every((w) => w.sunday + w.in_person + w.online === 0) ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            No attendance marked in these weeks.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              {series === 'sunday' && (
                <Bar dataKey="sunday" name="Sunday" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  <LabelList dataKey="sunday" position="top" fill="hsl(var(--muted-foreground))" fontSize={11} />
                </Bar>
              )}
              {series === 'fellowship' && (
                <Bar dataKey="in_person" name="In person" fill="hsl(var(--arrivals))" radius={[6, 6, 0, 0]} maxBarSize={36}>
                  <LabelList dataKey="in_person" position="top" fill="hsl(var(--muted-foreground))" fontSize={11} />
                </Bar>
              )}
              {series === 'fellowship' && (
                <Bar dataKey="online" name="Online" fill="hsl(var(--members))" radius={[6, 6, 0, 0]} maxBarSize={36}>
                  <LabelList dataKey="online" position="top" fill="hsl(var(--muted-foreground))" fontSize={11} />
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="min-w-28 text-center text-xs text-muted-foreground tabular-nums">{trend?.range ?? ''}</span>
        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </section>
  )
}
