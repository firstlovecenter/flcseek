/**
 * A CCG's meeting day + time mapped onto the availability vocabulary
 * ('Weekday Evenings', 'Saturday Mornings', …). Availability is scored against
 * the slot the group actually meets in, not the members' free time.
 * `meeting_slot` question options use the keys meetingSlotKey() returns.
 */

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const
export const MEETING_DAYS = [...WEEKDAYS, 'Saturday', 'Sunday'] as const
export type MeetingDay = (typeof MEETING_DAYS)[number]

/** Parse 'HH:MM' (24h) or '7:00 PM' / '7pm' into minutes after midnight. */
export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const m = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i)
  if (!m) return null
  let hours = Number(m[1])
  const minutes = m[2] ? Number(m[2]) : 0
  const meridiem = m[3]?.toLowerCase().replace(/\./g, '')
  if (minutes > 59) return null
  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    if (meridiem === 'pm' && hours !== 12) hours += 12
    if (meridiem === 'am' && hours === 12) hours = 0
  } else if (hours > 23) {
    return null
  }
  return hours * 60 + minutes
}

/** Normalise any accepted time string to 24h 'HH:MM', or null. */
export function normaliseTime(value: string | null | undefined): string | null {
  const mins = parseTimeToMinutes(value)
  if (mins === null) return null
  const h = String(Math.floor(mins / 60)).padStart(2, '0')
  const m = String(mins % 60).padStart(2, '0')
  return `${h}:${m}`
}

export function normaliseDay(value: string | null | undefined): MeetingDay | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  return MEETING_DAYS.find((d) => d.toLowerCase() === v || d.toLowerCase().slice(0, 3) === v) ?? null
}

export function meetingSlot(day: string | null | undefined, time: string | null | undefined): string | null {
  const d = normaliseDay(day)
  const mins = parseTimeToMinutes(time)
  if (!d || mins === null) return null
  const prefix = (WEEKDAYS as readonly string[]).includes(d) ? 'Weekday' : d
  const part = mins < 12 * 60 ? 'Mornings' : mins < 17 * 60 ? 'Afternoons' : 'Evenings'
  return `${prefix} ${part}`
}

/** 'Weekday Evenings' → 'weekday_evenings' — the option key convention. */
export function meetingSlotKey(day: string | null | undefined, time: string | null | undefined): string | null {
  const slot = meetingSlot(day, time)
  return slot ? slot.toLowerCase().replace(/\s+/g, '_') : null
}

/** '19:00' → '7:00 PM' for display. */
export function formatTime12h(value: string | null | undefined): string {
  const mins = parseTimeToMinutes(value)
  if (mins === null) return value ?? ''
  const h24 = Math.floor(mins / 60)
  const m = String(mins % 60).padStart(2, '0')
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${m} ${h24 < 12 ? 'AM' : 'PM'}`
}
