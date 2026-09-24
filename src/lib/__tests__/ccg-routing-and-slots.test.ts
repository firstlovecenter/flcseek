import { describe, it, expect } from 'vitest'
import { meetingSlot, normaliseTime, parseTimeToMinutes, formatTime12h } from '@/lib/ccg/engine'
import { landingPathFor, availableApps } from '@/lib/app-routing'

describe('meeting slots', () => {
  it('maps weekday evenings, Saturday mornings and Sunday afternoons', () => {
    expect(meetingSlot('Monday', '19:00')).toBe('Weekday Evenings')
    expect(meetingSlot('Saturday', '09:30')).toBe('Saturday Mornings')
    expect(meetingSlot('Sunday', '15:00')).toBe('Sunday Afternoons')
    expect(meetingSlot('Friday', '6:30 PM')).toBe('Weekday Evenings')
  })

  it('returns null when day or time is missing or invalid', () => {
    expect(meetingSlot(null, '19:00')).toBeNull()
    expect(meetingSlot('Funday', '19:00')).toBeNull()
    expect(meetingSlot('Monday', '25:00')).toBeNull()
  })

  it('normalises 12-hour times to 24h', () => {
    expect(normaliseTime('7:00 PM')).toBe('19:00')
    expect(normaliseTime('12:00 AM')).toBe('00:00')
    expect(normaliseTime('4pm')).toBe('16:00')
    expect(parseTimeToMinutes('nonsense')).toBeNull()
    expect(formatTime12h('19:00')).toBe('7:00 PM')
  })
})

describe('app routing (shared users table)', () => {
  it('sends CCG-only users to /ccg', () => {
    expect(landingPathFor({ ccg_access: true })).toBe('/ccg')
  })

  it('sends users with both roles to the launcher', () => {
    expect(landingPathFor({ role: 'superadmin', ccg_access: true })).toBe('/apps')
    expect(availableApps({ role: 'leader', ccg_access: true })).toEqual(['seek', 'ccg'])
  })

  it('keeps Seek-only landing unchanged', () => {
    expect(landingPathFor({ role: 'superadmin' })).toBe('/superadmin')
    expect(landingPathFor({ role: 'leader', group_id: 'g1' })).toBe('/g1')
    expect(landingPathFor({ role: 'leadpastor' })).toBe('/')
  })

  it('sends users with no role back to sign-in', () => {
    expect(landingPathFor({})).toBe('/auth')
    expect(landingPathFor(null)).toBe('/auth')
  })
})
