'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import {
  CalendarCheck,
  Check,
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
import { LEVEL_LABEL, focusQuery, useCcgFocus, useLeaderView, useSeekingRole } from '@/components/ccg/CcgFocusProvider'
import { ConvertMilestones } from '@/components/ccg/ConvertMilestones'
import { hourlyGreeting, splitName } from '@/components/ccg/greetings'
import { FocusPicker, groupHref } from '@/components/ccg/synago'
import { SeekerHome } from '@/components/ccg/SeekerHome'
import { hasChosen } from '@/components/ccg/campus-choice'
import { MonthPicker, StreamPicker, useMonthParam } from '@/components/ccg/LeaderView'
import { DashboardNumbers, WeeklyTrend, type Dashboard } from '@/components/ccg/UnitReport'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 22 } },
}
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.06 } } }

const TASK_ICON: Record<string, LucideIcon> = {
  sunday_attendance: CalendarCheck,
  fellowship_attendance: Users,
  intercession: HandHeart,
  fellowship_service: Users,
  fellowship_meal: Soup,
  approvals: ClipboardCheck,
  held: PauseCircle,
}

export default function CcgHomePage() {
  const { me, has } = useCcgMe()
  const { focus, options } = useCcgFocus()
  const router = useRouter()
  const [d, setD] = useState<Dashboard | null>(null)
  const q = focusQuery(focus)
  const waitingForFocus = options.length > 0 && !focus
  // Other campus roles choose a portal when they sign in. A Campus Leader doesn't: Home asks them
  // for a month and a stream, as Seek asked its Lead Pastor for a group.
  const leadsCampus = !!me?.roles.some((r) => r.unit?.type === 'campus' && r.role.key !== 'campus_leader')
  useEffect(() => {
    if (leadsCampus && !hasChosen()) router.replace('/ccg/choose')
  }, [leadsCampus, router])
  // With the Sheep Seeker role in focus, home is the stream's converts against their milestones (as in Seek).
  const seekingRole = useSeekingRole()
  const seeker = seekingRole !== null
  // A Sheep Seeking Liaison follows the converts in their CCFs; other Sheep Seekers, their stream's.
  const liaison = seekingRole === 'seeker' && !!me?.liaison_ccfs?.length
  // A Campus Leader or Stream Leader in focus: a month, then (a campus) a stream, then its milestones board.
  const leader = useLeaderView()

  useEffect(() => {
    if (!has('reports.view') || waitingForFocus || seeker || leader) return
    setD(null)
    ccgApi.get<Dashboard>(`/dashboard${q ? `?${q}` : ''}`).then((r) => r.ok && setD(r.data))
  }, [has, q, waitingForFocus, seeker, leader])

  const firstName = me?.user.name.split(' ')[0] ?? ''
  const greeting = useMemo(() => hourlyGreeting(firstName, me?.user.id ?? ''), [firstName, me?.user.id])
  const [before, name, after] = splitName(greeting, firstName)
  const loading = !d
  const isUnit = !!focus && focus.type !== 'global'
  const overdue = d?.placements.milestones_overdue ?? 0

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

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  if (leader) {
    return (
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <LeaderHome leader={leader} />
      </Suspense>
    )
  }

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

      {seeker && (
        <motion.div variants={fadeUp} className="mt-8 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {liaison ? 'My' : focus?.name} <span className="text-members">Converts</span>
            </h2>
            {has('people.manage') && (
              <Button variant="outline" className="h-10 gap-1.5" asChild>
                <Link href="/ccg/converts?view=all&new=1">
                  <UserPlus className="size-4" />
                  <span className="hidden sm:inline">Register convert</span>
                </Link>
              </Button>
            )}
          </div>
          <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
            <ConvertMilestones mine={liaison} />
          </Suspense>
          {seekingRole === 'seeker' && <SeekerHome />}
        </motion.div>
      )}

      {!seeker && has('reports.view') && (
        <motion.div variants={stagger} className="mt-8 flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px] lg:items-start">
          {/* Primary column */}
          <motion.div variants={fadeUp} className="min-w-0 space-y-6">
            <DashboardNumbers loading={loading} primary={primary} secondaries={secondaries} />

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

            {!waitingForFocus && <WeeklyTrend q={q} subtitle={focus ? `${focus.name} · ${LEVEL_LABEL[focus.type]}` : 'Across your units'} />}
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

/**
 * Seek's Lead Pastor "Select A Group": a month, then (a Campus Leader) a
 * stream; both end on that stream's milestones page. A Stream Leader's CCGs
 * are in the sidebar.
 */
function LeaderHome({ leader }: { leader: NonNullable<ReturnType<typeof useLeaderView>> }) {
  const router = useRouter()
  const month = useMonthParam()
  const open = (streamId: string, m: string) => router.push(`/ccg/lead/stream/${streamId}?month=${m}`)
  if (leader.type === 'stream') return <MonthPicker unit={leader} onPick={(m) => open(leader.id, m)} />
  if (!month) return <MonthPicker unit={leader} onPick={(m) => router.push(`/ccg?month=${m}`)} />
  return <StreamPicker campusId={leader.id} month={month} onPick={(id) => open(id, month)} />
}
