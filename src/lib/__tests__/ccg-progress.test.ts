import { describe, it, expect } from 'vitest'
import {
  assessment,
  attendanceCompletion,
  checklistCompletion,
  daysSince,
  dueDate,
  heldThisPeriod,
  milestoneState,
  periodStart,
} from '@/lib/ccg/progress'

describe('milestone state (clock starts at approval)', () => {
  const approved = new Date(Date.UTC(2026, 8, 1))
  it('derives done / overdue / due soon / upcoming / no deadline', () => {
    expect(milestoneState(approved, 7, true, new Date(Date.UTC(2026, 11, 1)))).toBe('done')
    expect(milestoneState(approved, 7, false, new Date(Date.UTC(2026, 8, 20)))).toBe('overdue')
    expect(milestoneState(approved, 30, false, new Date(Date.UTC(2026, 8, 26)))).toBe('due_soon')
    expect(milestoneState(approved, 90, false, new Date(Date.UTC(2026, 8, 5)))).toBe('upcoming')
    expect(milestoneState(approved, null, false)).toBe('no_deadline')
  })
  it('computes due dates and elapsed days', () => {
    expect(dueDate(approved, 30)?.toISOString().slice(0, 10)).toBe('2026-10-01')
    expect(daysSince(approved, new Date(Date.UTC(2026, 8, 11)))).toBe(10)
  })
})

describe('auto-completing milestones (CCG Manual)', () => {
  it('completes an attendance milestone on the date of the target-th attendance', () => {
    const sundays = ['2026-09-20', '2026-09-06', '2026-09-13', '2026-09-13']
    expect(attendanceCompletion(sundays, 3)).toEqual({ complete: true, completedOn: '2026-09-20', done: 3, total: 3 })
    expect(attendanceCompletion(sundays, 20)).toEqual({ complete: false, completedOn: null, done: 3, total: 20 })
  })
  it('completes a checklist only when every active item is ticked, on the last date', () => {
    const done = new Map([
      ['a', '2026-09-02'],
      ['b', '2026-09-10'],
    ])
    expect(checklistCompletion(['a', 'b'], done)).toEqual({ complete: true, completedOn: '2026-09-10', done: 2, total: 2 })
    expect(checklistCompletion(['a', 'b', 'c'], done)).toMatchObject({ complete: false, done: 2, total: 3 })
    expect(checklistCompletion([], done).complete).toBe(false)
  })
})

describe('CCG activity periods', () => {
  const wed = new Date(Date.UTC(2026, 8, 23)) // Wednesday 23 Sep 2026
  it('weeks start on Monday; quarters on Jan/Apr/Jul/Oct 1', () => {
    expect(periodStart('weekly', wed)).toBe('2026-09-21')
    expect(periodStart('weekly', new Date(Date.UTC(2026, 8, 27)))).toBe('2026-09-21') // Sunday
    expect(periodStart('monthly', wed)).toBe('2026-09-01')
    expect(periodStart('quarterly', wed)).toBe('2026-07-01')
  })
  it('knows whether an activity was held this period', () => {
    expect(heldThisPeriod('weekly', '2026-09-23', wed)).toBe(true)
    expect(heldThisPeriod('weekly', '2026-09-16', wed)).toBe(false)
    expect(heldThisPeriod('quarterly', '2026-07-15', wed)).toBe(true)
    expect(heldThisPeriod('quarterly', null, wed)).toBe(false)
  })
})

describe('the assessment year', () => {
  const approved = new Date(Date.UTC(2026, 0, 10))
  it('runs 365 days from approval', () => {
    const a = assessment(approved, 365, 3, 9, new Date(Date.UTC(2026, 5, 1)))
    expect(a).toMatchObject({ ends_on: '2027-01-10', state: 'in_progress' })
    expect(a.days_left).toBe(223)
  })
  it('is complete once every milestone is reached, and ended when the year runs out first', () => {
    expect(assessment(approved, 365, 9, 9, new Date(Date.UTC(2026, 5, 1))).state).toBe('complete')
    expect(assessment(approved, 365, 8, 9, new Date(Date.UTC(2027, 1, 1)))).toMatchObject({ state: 'ended_incomplete', days_left: 0 })
  })
})
