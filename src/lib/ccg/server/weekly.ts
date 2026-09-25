import { prisma } from '@/lib/prisma'
import { dateOnly } from './common'
import type { UnitType } from './unit-overview'

/**
 * This week's duties for the unit in focus (the admin portal's "Week N"
 * tasks), and the weekly attendance trend. Weeks are ISO weeks, Monday to
 * Sunday, in UTC (Ghana time).
 */

const DAY = 86_400_000
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Monday 00:00 UTC of the ISO week containing `d`. */
export function weekStart(d: Date): Date {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY)
}

/** ISO week number. */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((t.getTime() - firstThursday.getTime()) / DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
}

export type TaskState = 'done' | 'due' | 'upcoming'
export interface WeeklyTask {
  key: string
  label: string
  state: TaskState
  /** e.g. "Sunday" or "3 waiting". */
  detail: string | null
  href: string
}

/** Due from `dayIndex` (0 = Monday) of the current week. */
const stateFor = (done: boolean, dayIndex: number, todayIndex: number): TaskState => (done ? 'done' : todayIndex >= dayIndex ? 'due' : 'upcoming')

export async function weeklyTasks(focus: { type: UnitType; id: string } | null, now = new Date()) {
  const monday = weekStart(now)
  const sunday = new Date(monday.getTime() + 6 * DAY)
  const todayIndex = (now.getUTCDay() + 6) % 7
  const inWeek = { gte: monday, lte: sunday }
  const tasks: WeeklyTask[] = []
  let schedule: string | null = null

  if (focus?.type === 'ccf') {
    const f = await prisma.ccgFamily.findUnique({ where: { id: focus.id }, select: { meetingDay: true } })
    const [sundays, fellowships] = await Promise.all([
      prisma.ccgAttendance.count({ where: { ccfId: focus.id, eventType: 'sunday_service', eventDate: inWeek } }),
      prisma.ccgAttendance.count({ where: { ccfId: focus.id, eventType: { in: ['in_person_fellowship', 'online_fellowship'] }, eventDate: inWeek } }),
    ])
    const meetingIndex = f?.meetingDay ? DAYS.indexOf(f.meetingDay) : -1
    tasks.push({
      key: 'fellowship_attendance',
      label: 'Mark fellowship attendance',
      state: stateFor(fellowships > 0, meetingIndex >= 0 ? meetingIndex : 2, todayIndex),
      detail: f?.meetingDay ?? null,
      href: `/ccg/attendance?ccf=${focus.id}&event=in_person_fellowship`,
    })
    tasks.push({
      key: 'sunday_attendance',
      label: 'Mark Sunday attendance',
      state: stateFor(sundays > 0, 6, todayIndex),
      detail: 'Sunday',
      href: `/ccg/attendance?ccf=${focus.id}&event=sunday_service`,
    })
    schedule = `Fellowship on ${f?.meetingDay ?? 'its meeting day'}, church on Sunday.`
  } else if (focus?.type === 'ccg') {
    const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (now.getUTCMonth() % 3), 1))
    const [intercession, meal] = await Promise.all([
      prisma.ccgGroupActivity.count({ where: { ccgId: focus.id, typeKey: 'intercession', heldOn: inWeek } }),
      prisma.ccgGroupActivity.count({ where: { ccgId: focus.id, typeKey: 'fellowship_meal', heldOn: { gte: quarterStart } } }),
    ])
    tasks.push({
      key: 'intercession',
      label: 'Wednesday intercession',
      state: stateFor(intercession > 0, 2, todayIndex),
      detail: 'Wednesday, 5:00–5:30am',
      href: '/ccg/activities',
    })
    tasks.push({
      key: 'fellowship_meal',
      label: 'Fellowship over food',
      state: meal > 0 ? 'done' : 'due',
      detail: 'This quarter',
      href: '/ccg/activities',
    })
    schedule = 'Intercession on Wednesday morning; an outing over food each quarter.'
  } else {
    // Campus, stream or church-wide: the front of the process (Sheep Seekers, central team).
    const where =
      focus?.type === 'stream'
        ? { person: { deletedAt: null, streamId: focus.id } }
        : focus?.type === 'campus'
          ? { person: { deletedAt: null, stream: { campusId: focus.id } } }
          : focus?.type === 'council'
            ? { person: { deletedAt: null }, proposedCcf: { ccg: { councilId: focus.id } } }
            : { person: { deletedAt: null } }
    const [proposed, held] = await Promise.all([
      prisma.ccgPlacement.count({ where: { status: 'proposed', ...where } }),
      prisma.ccgPlacement.count({ where: { status: 'held', ...where } }),
    ])
    tasks.push({
      key: 'approvals',
      label: 'Review proposed placements',
      state: proposed ? 'due' : 'done',
      detail: proposed ? `${proposed} waiting` : 'Queue is clear',
      href: '/ccg/approvals',
    })
    tasks.push({
      key: 'held',
      label: 'Converts on hold',
      state: held ? 'due' : 'done',
      detail: held ? `${held} need attention` : 'None',
      href: '/ccg/approvals',
    })
    schedule = 'New converts are matched as they register.'
  }
  return { week: isoWeek(now), week_start: dateOnly(monday), schedule, tasks }
}

export type TrendSeries = 'sunday' | 'fellowship'

/**
 * Weekly attendance for a set of CCFs: `weeks` ISO weeks ending `offset`
 * pages before the current week. Sunday: one series; fellowship: in person
 * and online.
 */
export async function attendanceTrend(ccfIds: string[] | 'all', series: TrendSeries, weeks = 5, offset = 0, now = new Date()) {
  const lastStart = new Date(weekStart(now).getTime() - offset * weeks * 7 * DAY)
  const firstStart = new Date(lastStart.getTime() - (weeks - 1) * 7 * DAY)
  const end = new Date(lastStart.getTime() + 7 * DAY - 1)
  const events = series === 'sunday' ? ['sunday_service'] : ['in_person_fellowship', 'online_fellowship']
  const rows = await prisma.ccgAttendance.findMany({
    where: {
      eventType: { in: events },
      eventDate: { gte: firstStart, lte: end },
      ...(ccfIds === 'all' ? {} : { ccfId: { in: ccfIds } }),
    },
    select: { eventType: true, eventDate: true },
  })
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(firstStart.getTime() + i * 7 * DAY)
    return { week: isoWeek(start), label: `W${isoWeek(start)}`, start: dateOnly(start)!, sunday: 0, in_person: 0, online: 0 }
  })
  for (const r of rows) {
    const i = Math.floor((weekStart(r.eventDate).getTime() - firstStart.getTime()) / (7 * DAY))
    const b = buckets[i]
    if (!b) continue
    if (r.eventType === 'sunday_service') b.sunday++
    else if (r.eventType === 'in_person_fellowship') b.in_person++
    else b.online++
  }
  return { series, weeks: buckets, range: `${buckets[0].label} – ${buckets[buckets.length - 1].label}` }
}
