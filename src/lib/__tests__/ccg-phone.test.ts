import { describe, expect, it } from 'vitest'
import { normalizePhone, phoneProblem } from '@/lib/ccg/server/common'

describe('normalizePhone', () => {
  it('stores one Ghana number the same way however it is typed', () => {
    const typed = ['0241234567', '024 123 4567', '241234567', '+233241234567', '+233 24 123 4567', '+233 (0)24 123 4567', '233-024-123-4567', '00233241234567']
    for (const t of typed) expect(normalizePhone(t), t).toBe('233241234567')
  })

  it('keeps landlines and other countries', () => {
    expect(normalizePhone('030 221 0000')).toBe('233302210000')
    expect(normalizePhone('+44 7700 900123')).toBe('447700900123')
    expect(normalizePhone('+1 (202) 555-0143')).toBe('12025550143')
  })

  it('refuses numbers that cannot be right', () => {
    for (const t of ['054696886', '050814408', '02412345678', '2332412345', '233141234567', '12345', 'abc']) {
      expect(normalizePhone(t), t).toBeNull()
      expect(phoneProblem(t), t).not.toBeNull()
    }
  })

  it('members and converts need a Ghana number', () => {
    expect(phoneProblem('+44 7700 900123')).toBe('Enter a Ghana phone number, e.g. 024 123 4567')
    expect(phoneProblem('024 123 4567')).toBeNull()
  })

  it('an empty number is not a problem', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(phoneProblem('  ')).toBeNull()
    expect(phoneProblem(undefined)).toBeNull()
  })
})

describe('phoneSearchDigits', () => {
  it('a number searched the local way matches how it is stored', async () => {
    const { phoneSearchDigits } = await import('@/lib/ccg/phone-search')
    const stored = '233241234567'
    for (const t of ['0241234567', '024 123', '+233 24 123 4567', '233241234567', '00233241234567', '+233 (0)24 123']) {
      expect(stored.includes(phoneSearchDigits(t)), t).toBe(true)
    }
    expect(phoneSearchDigits('Mandy')).toBe('')
  })
})
