'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis } from 'recharts'
import {
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  HandHeart,
  PauseCircle,
  Soup,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { LEVEL_LABEL, focusQuery, useCcgFocus } from '@/components/ccg/CcgFocusProvider'
import { hourlyGreeting, splitName } from '@/components/ccg/greetings'
import { FocusPicker, groupHref } from '@/components/ccg/synago'
import { SeekerHome } from '@/components/ccg/SeekerHome'

interface Dashboard {
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

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 22 } },
}
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.06 } } }

const TASK_ICON: Record<string, LucideIcon> = {
  sunday_attendance: CalendarCheck,
  fellowship_attendance: Users,
  intercession: HandHeart,
  fellowship_meal: Soup,
  approvals: ClipboardCheck,
  held: PauseCircle,
}

export default function CcgHomePage() {
  const { me, has } = useCcgMe()
  const { focus, options } = useCcgFocus()
  const router = useRouter()
  const [d, setD] = useState<Dashboard | null>(null)
  const [series, setSeries] = useState<'sunday' | 'fellowship'>('sunday')
  const [page, setPage] = useState(0)
  const [trend, setTrend] = useState<Trend | null>(null)
  const q = focusQuery(focus)
  const waitingForFocus = options.length > 0 && !focus

  useEffect(() => {
    if (!has('reports.view') || waitingForFocus) return
    setD(null)
    ccgApi.get<Dashboard>(`/dashboard${q ? `?${q}` : ''}`).then((r) => r.ok && setD(r.data))
  }, [has, q, waitingForFocus])

  useEffect(() => {
    if (!has('reports.view') || waitingForFocus) return
    setTrend(null)
    ccgApi.get<Trend>(`/trends?series=${series}&offset=${page}${q ? `&${q}` : ''}`).then((r) => r.ok && setTrend(r.data))
  }, [has, q, series, page, waitingForFocus])

  const firstName = me?.user.name.split(' ')[0] ?? ''
  const greeting = useMemo(() => hourlyGreeting(firstName, me?.user.id ?? ''), [firstName, me?.user.id])
  const [before, name, after] = splitName(greeting, firstName)
  const loading = !d
  const isUnit = !!focus && focus.type !== 'global'
  const overdue = d?.placements.milestones_overdue ?? 0
  const isSeeker = !!me?.roles.some((r) => r.role.key === 'sheep_seeker')

  const primary = isUnit
    ? { label: 'Converts in their assessment year', value: d?.placements.active ?? 0 }
    : { label: 'Awaiting approval', value: d?.queue?.proposed ?? 0 }
  const secondaries = [
    isUnit ? { label: 'Members', value: d?.units.members ?? 0 } : { label: 'Converts placed', value: d?.placements.active ?? 0 },
    { label: 'Milestones overdue', value: overdue, warn: overdue > 0 },
  ]

  const attendanceHref = focus?.type === 'ccf' ? `/ccg/attendance?ccf=${focus.id}` : '/ccg/attendance'
  const quickActions = [
    has('people.manage') && { id: 'convert', label: 'Register convert', icon: UserPlus, accent: 'hsl(var(--members))', href: '/ccg/converts?new=1' },
    has('attendance.mark') && { id: 'attendance', label: 'Mark attendance', icon: CalendarCheck, accent: 'hsl(var(--arrivals))', href: attendanceHref },
    has('people.manage') && { id: 'member', label: 'Add member', icon: Users, accent: 'hsl(var(--success))', href: '/ccg/members?new=1' },
    has('placements.approve') && { id: 'approvals', label: 'Review approvals', icon: ClipboardCheck, accent: 'hsl(var(--primary))', href: '/ccg/approvals' },
    has('activities.record') && { id: 'activity', label: 'Log CCG activity', icon: HandHeart, accent: 'hsl(var(--campaigns))', href: '/ccg/activities' },
  ].filter(Boolean) as Array<{ id: string; label: string; icon: LucideIcon; accent: string; href: string }>

  const chartData = trend?.weeks ?? []
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="pb-10 md:pt-2">
      {/* Header band */}
      <motion.header variants={fadeUp} className="flex flex-col gap-5 pr-14 sm:flex-row sm:items-start sm:justify-between md:pr-0">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{today}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {me ? (
              <>
                {before}
                <span className="text-primary">{name}</span>
                {after}
              </>
            ) : (
              <Skeleton className="h-10 w-72 max-w-full" />
            )}
          </h1>
          {focus ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-medium">
                {focus.name}
              </Badge>
              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs font-normal text-muted-foreground">
                {LEVEL_LABEL[focus.type]}
              </Badge>
              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs font-normal text-muted-foreground">
                {focus.role}
              </Badge>
            </div>
          ) : (
            me && options.length === 0 && <p className="mt-2 text-sm text-muted-foreground">You have no roles in City Church Group yet.</p>
          )}
        </div>
        <FocusPicker className="w-full shrink-0 sm:w-72" />
      </motion.header>

      {has('reports.view') && (
        <motion.div variants={stagger} className="mt-8 flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px] lg:items-start">
          {/* Primary column */}
          <motion.div variants={fadeUp} className="min-w-0 space-y-6">
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
              <div className="grid grid-cols-2 divide-x divide-border">
                {secondaries.map((s) => (
                  <div key={s.label} className="px-6 py-4">
                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{s.label}</p>
                    {loading ? (
                      <Skeleton className="mt-2 h-7 w-20" />
                    ) : (
                      <p className={cn('mt-1 text-2xl font-semibold tracking-tight tabular-nums', s.warn ? 'text-warning' : 'text-foreground')}>
                        {s.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {isSeeker && <SeekerHome />}

            {/* This week */}
            <section>
              <div className="mb-3">
                <h2 className="text-sm font-medium text-foreground">Week {d?.week.week ?? ''}</h2>
                {d?.week.schedule && <p className="mt-0.5 text-xs text-muted-foreground">{d.week.schedule}</p>}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {!d
                  ? [0, 1].map((i) => <Skeleton key={i} className="h-[74px] rounded-2xl" />)
                  : d.week.tasks.map((t) => {
                      const Icon = TASK_ICON[t.key] ?? ClipboardCheck
                      const done = t.state === 'done'
                      const upcoming = t.state === 'upcoming'
                      return (
                        <div
                          key={t.key}
                          className={cn(
                            'flex items-center gap-4 rounded-2xl border p-4 transition-colors',
                            done ? 'border-success/30 bg-success/5' : upcoming ? 'border-border bg-muted/30' : 'border-border bg-card'
                          )}
                        >
                          <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', done ? 'bg-success text-white' : 'bg-muted text-muted-foreground')}>
                            {done ? <Check className="size-5" /> : <Icon className="size-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{t.label}</p>
                            <span
                              className={cn(
                                'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
                                done ? 'bg-success/15 text-success' : upcoming ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive dark:bg-destructive/20'
                              )}
                            >
                              {done ? 'Done' : upcoming ? 'Upcoming' : 'Due'}
                            </span>
                            {t.detail && <span className="ml-2 text-xs text-muted-foreground">{t.detail}</span>}
                          </div>
                          <Button
                            size="sm"
                            variant={done ? 'outline' : 'default'}
                            onClick={() => router.push(t.href)}
                            className={cn('shrink-0', upcoming && 'bg-primary/20 text-foreground hover:bg-primary/30')}
                          >
                            {done ? 'View' : upcoming ? 'Not due yet' : 'Do it now'}
                          </Button>
                        </div>
                      )
                    })}
              </div>
            </section>

            {/* Weekly trend */}
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-medium text-foreground">Weekly trend</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {focus ? `${focus.name} · ${LEVEL_LABEL[focus.type]}` : 'Across your units'} · placed converts
                  </p>
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
          </motion.div>

          {/* Supporting column */}
          <motion.aside variants={fadeUp} className="space-y-4 lg:sticky lg:top-6">
            {quickActions.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Quick actions</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4 lg:grid-cols-1 lg:gap-0 lg:divide-y lg:divide-border lg:p-0">
                  {quickActions.map((a) => {
                    const Icon = a.icon
                    return (
                      <Link
                        key={a.id}
                        href={a.href}
                        className={cn(
                          'group flex min-h-11 flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent active:scale-[0.98]',
                          'lg:flex-row lg:items-center lg:rounded-none lg:border-0 lg:bg-transparent lg:px-4 lg:py-3 lg:hover:bg-accent/60 lg:active:scale-100'
                        )}
                      >
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: `color-mix(in srgb, ${a.accent} 12%, transparent)`, color: a.accent }}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="flex-1 text-sm leading-tight font-medium text-foreground">{a.label}</span>
                        <ChevronRight className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 lg:block" />
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {focus && (
              <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Current focus</h3>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Church</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{focus.name}</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Level</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{LEVEL_LABEL[focus.type]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Role</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{focus.role}</p>
                    </div>
                  </div>
                  {(d?.members_pending_confirmation ?? 0) > 0 && (
                    <Badge variant="warning" className="rounded-full">
                      {d!.members_pending_confirmation} member{d!.members_pending_confirmation === 1 ? '' : 's'} to confirm
                    </Badge>
                  )}
                  {focus.id && focus.type !== 'global' && (
                    <>
                      <Separator />
                      <Button variant="outline" className="w-full" asChild>
                        <Link href={groupHref(focus.type, focus.id)}>
                          Open {focus.name}
                          <ChevronRight className="size-4" />
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </section>
            )}
          </motion.aside>
        </motion.div>
      )}
    </motion.div>
  )
}
