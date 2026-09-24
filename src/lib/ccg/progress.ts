/**
 * Integration milestone status. Derived, never stored: assignment date +
 * milestone target_days compared with today, plus whether it is completed.
 * No cron job is needed to flip "due" to "overdue".
 */

export type MilestoneState = 'done' | 'overdue' | 'due_soon' | 'upcoming' | 'no_deadline'

export const MILESTONE_STATE_LABELS: Record<MilestoneState, string> = {
  done: 'Done',
  overdue: 'Overdue',
  due_soon: 'Due soon',
  upcoming: 'Not yet due',
  no_deadline: 'No deadline',
}

const DAY_MS = 24 * 60 * 60 * 1000
/** A milestone within this many days of its deadline shows as "due soon". */
export const DUE_SOON_DAYS = 7

export function dueDate(assignedAt: Date | string, targetDays: number | null): Date | null {
  if (targetDays === null || targetDays === undefined) return null
  const start = typeof assignedAt === 'string' ? new Date(assignedAt) : assignedAt
  return new Date(start.getTime() + targetDays * DAY_MS)
}

export function milestoneState(
  assignedAt: Date | string,
  targetDays: number | null,
  isCompleted: boolean,
  today: Date = new Date()
): MilestoneState {
  if (isCompleted) return 'done'
  const due = dueDate(assignedAt, targetDays)
  if (!due) return 'no_deadline'
  const daysLeft = (due.getTime() - today.getTime()) / DAY_MS
  if (daysLeft < 0) return 'overdue'
  if (daysLeft <= DUE_SOON_DAYS) return 'due_soon'
  return 'upcoming'
}

/** Days since assignment, floored. */
export function daysSince(assignedAt: Date | string, today: Date = new Date()): number {
  const start = typeof assignedAt === 'string' ? new Date(assignedAt) : assignedAt
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / DAY_MS))
}

// ---------------------------------------------------------------------------
// The assessment year: each convert is assessed over a fixed period from the
// approval of their placement (CCG Manual: one year).
// ---------------------------------------------------------------------------

export type AssessmentState = 'in_progress' | 'complete' | 'ended_incomplete'

export const ASSESSMENT_STATE_LABELS: Record<AssessmentState, string> = {
  in_progress: 'In progress',
  complete: 'All milestones reached',
  ended_incomplete: 'Year ended, milestones missed',
}

export function assessment(
  assignedAt: Date | string,
  days: number,
  milestonesDone: number,
  milestonesTotal: number,
  today: Date = new Date()
) {
  const ends = dueDate(assignedAt, days)!
  const daysLeft = Math.ceil((ends.getTime() - today.getTime()) / DAY_MS)
  const state: AssessmentState =
    milestonesTotal > 0 && milestonesDone >= milestonesTotal ? 'complete' : daysLeft < 0 ? 'ended_incomplete' : 'in_progress'
  return { ends_on: ends.toISOString().slice(0, 10), days_left: Math.max(0, daysLeft), state }
}

// ---------------------------------------------------------------------------
// Milestone kinds (CCG Manual): ticked by hand, completed by an attendance
// count, or completed by a checklist.
// ---------------------------------------------------------------------------

export const MILESTONE_KINDS = ['manual', 'attendance', 'checklist'] as const
export type MilestoneKind = (typeof MILESTONE_KINDS)[number]

export const ATTENDANCE_EVENTS = ['sunday_service', 'online_fellowship', 'in_person_fellowship'] as const
export type AttendanceEvent = (typeof ATTENDANCE_EVENTS)[number]

export const ATTENDANCE_EVENT_LABELS: Record<AttendanceEvent, string> = {
  sunday_service: 'Sunday service',
  online_fellowship: 'Online fellowship',
  in_person_fellowship: 'In-person fellowship',
}

export interface AutoCompletion {
  complete: boolean
  /** The day it completed: the target-th attendance, or the last checklist item. */
  completedOn: string | null
  done: number
  total: number
}

/** Attendance milestone: complete on the date of the `target`-th attendance. */
export function attendanceCompletion(dates: string[], target: number): AutoCompletion {
  const sorted = [...new Set(dates)].sort()
  const complete = target > 0 && sorted.length >= target
  return { complete, completedOn: complete ? sorted[target - 1] : null, done: sorted.length, total: target }
}

/** Checklist milestone: complete when every active item is done, on the last one's date. */
export function checklistCompletion(activeItemIds: string[], doneOn: Map<string, string>): AutoCompletion {
  const dates = activeItemIds.map((id) => doneOn.get(id)).filter((d): d is string => !!d)
  const complete = activeItemIds.length > 0 && dates.length === activeItemIds.length
  const last = [...dates].sort()[dates.length - 1]
  return { complete, completedOn: complete ? last : null, done: dates.length, total: activeItemIds.length }
}

// ---------------------------------------------------------------------------
// CCG activities: is one due in the current period?
// ---------------------------------------------------------------------------

export type Cadence = 'weekly' | 'monthly' | 'quarterly'

/** First day (UTC, yyyy-mm-dd) of the period containing `today`. Weeks start on Monday. */
export function periodStart(cadence: Cadence, today: Date = new Date()): string {
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  let d: Date
  if (cadence === 'weekly') {
    const back = (today.getUTCDay() + 6) % 7
    d = new Date(Date.UTC(y, m, today.getUTCDate() - back))
  } else if (cadence === 'monthly') d = new Date(Date.UTC(y, m, 1))
  else d = new Date(Date.UTC(y, m - (m % 3), 1))
  return d.toISOString().slice(0, 10)
}

/** Held this period (on or after its start), given the latest date it was held. */
export function heldThisPeriod(cadence: Cadence, lastHeldOn: string | null, today: Date = new Date()): boolean {
  return !!lastHeldOn && lastHeldOn >= periodStart(cadence, today)
}
