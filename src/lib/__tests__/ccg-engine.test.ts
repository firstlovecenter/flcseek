import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CCG_CONFIG,
  ageOn,
  rankUnits,
  resolveCcgConfig,
  scorePair,
  validateAnswers,
  isProfileComplete,
  parseSignal,
  meetingSlotKey,
} from '@/lib/ccg/engine'
import { QUESTIONS, convert, ctx, factor, person, profile, unit } from './ccg-fixtures'

const fans = (n: number, answers = { interests: ['football'] }) => Array.from({ length: n }, () => person(answers))

// ---------------------------------------------------------------------------
// The prototype's test scenarios, on synthetic fixtures
// ---------------------------------------------------------------------------
describe('matching scenarios', () => {
  it('strong interest similarity scores high on interests', () => {
    const c = convert({ interests: ['football', 'business'] })
    const p = profile(unit('A'), fans(6, { interests: ['football', 'business'] }))
    expect(factor(scorePair(c, p, ctx()), 'interests')).toBe(100)
  })

  it('same age but different interests: high age, low interests', () => {
    const c = convert({ interests: ['arts', 'photography'] }, { age: 32 })
    const members = [30, 31, 32, 33, 34].map((age) => person({ interests: ['business'] }, { age }))
    const r = scorePair(c, profile(unit('A'), members), ctx())
    expect(factor(r, 'age')).toBe(100)
    expect(factor(r, 'interests')).toBe(0)
  })

  it('same zone, different social style: location 100, social low', () => {
    const c = convert({ trait_new_people: 1, trait_group_activity: 1 })
    const members = fans(5, { trait_new_people: 5, trait_group_activity: 5 } as never)
    const r = scorePair(c, profile(unit('A'), members), ctx())
    expect(factor(r, 'location')).toBe(100)
    expect(factor(r, 'social')).toBe(0)
  })

  it('an existing connection in a CCF counts there and is explained', () => {
    const friend = person()
    const c = convert({}, { existingConnectionMemberId: friend.id })
    const a = scorePair(c, profile(unit('A'), [friend, person(), person()]), ctx())
    const b = scorePair(c, profile(unit('B'), [person(), person(), person()]), ctx())
    expect(factor(a, 'connection')).toBe(100)
    expect(factor(b, 'connection')).toBe(0)
    expect(a.reasons).toContain('Already knows someone in this CCF')
  })

  it('the best match is full: excluded from the top 3', () => {
    const c = convert({ interests: ['football'] })
    const full = profile(unit('FULL', { capacity: 6 }), fans(6))
    const open = profile(unit('OPEN'), [person({ interests: ['football'] }), person({ interests: ['music'] })])
    const r = rankUnits(c, [full, open], ctx())
    expect(r.ranked[0].ccfCode).toBe('FULL')
    expect(r.top.map((u) => u.ccfCode)).toEqual(['OPEN'])
    expect(r.ineligible[0].ineligibleReasons).toContain('full')
  })

  it('no connection: the factor is left out and a recommendation still comes', () => {
    const r = rankUnits(convert({ interests: ['music'] }), [profile(unit('A'), [person({ interests: ['music'] })])], ctx())
    expect(factor(r.top[0], 'connection')).toBeNull()
    expect(r.top).toHaveLength(1)
  })

  it('every CCF full: "No eligible CCF available"', () => {
    const profiles = ['A', 'B'].map((c) => profile(unit(c, { capacity: 2 }), [person(), person()]))
    const r = rankUnits(convert(), profiles, ctx())
    expect(r.top).toEqual([])
    expect(r.warnings).toContain('No eligible CCF available.')
  })
})

// ---------------------------------------------------------------------------
// Fixes carried over from the prototype review
// ---------------------------------------------------------------------------
describe('prototype defect regressions', () => {
  it('zone changes the ranking', () => {
    const c = convert({}, { zoneId: 'zone-b' })
    const near = profile(unit('NEAR', { zoneId: 'zone-b' }), [person(), person(), person()])
    const far = profile(unit('FAR', { zoneId: 'zone-a' }), [person(), person(), person()])
    expect(rankUnits(c, [far, near], ctx()).top[0].ccfCode).toBe('NEAR')
  })

  it('friendship preferences are scored live against the group', () => {
    const p = profile(unit('A'), fans(4, { interests: ['football'], trait_group_activity: 5 } as never))
    expect(factor(scorePair(convert({ friendship_prefs: ['sports'] }), p, ctx()), 'friendship')).toBe(100)
    expect(factor(scorePair(convert({ friendship_prefs: ['technology'] }), p, ctx()), 'friendship')).toBe(0)
    expect(factor(scorePair(convert({ friendship_prefs: ['social'] }), p, ctx()), 'friendship')).toBe(100)
    expect(factor(scorePair(convert({ friendship_prefs: ['calm'] }), p, ctx()), 'friendship')).toBe(0)
  })

  it('a "fits anyone" preference gives no free points', () => {
    const p = profile(unit('A'), [person(), person()])
    expect(factor(scorePair(convert({ friendship_prefs: ['anyone'] }), p, ctx()), 'friendship')).toBeNull()
  })

  it('"similar interests" preference follows the interests score', () => {
    const p = profile(unit('A'), fans(4))
    const yes = scorePair(convert({ interests: ['football'], friendship_prefs: ['similar_interests'] }), p, ctx())
    const no = scorePair(convert({ interests: ['arts'], friendship_prefs: ['similar_interests'] }), p, ctx())
    expect(factor(yes, 'friendship')).toBe(100)
    expect(factor(no, 'friendship')).toBe(0)
  })

  it('"same line of work" preference uses the occupation answers', () => {
    const p = profile(unit('A'), fans(2, { occupation: 'health' } as never))
    expect(factor(scorePair(convert({ occupation: 'health', friendship_prefs: ['same_work'] }), p, ctx()), 'friendship')).toBe(100)
  })

  it('full CCFs are off by default', () => {
    expect(DEFAULT_CCG_CONFIG.allowFullOverride).toBe(false)
  })

  it('availability is judged against when the CCF meets', () => {
    const members = fans(3)
    const monday = profile(unit('MON', { meetingDay: 'Monday', meetingTime: '19:00' }), members)
    const sat = profile(unit('SAT', { meetingDay: 'Saturday', meetingTime: '09:30' }), members)
    const c = convert({ availability: ['saturday_mornings'] })
    expect(factor(scorePair(c, monday, ctx()), 'availability')).toBe(0)
    expect(factor(scorePair(c, sat, ctx()), 'availability')).toBe(100)
    expect(scorePair(c, monday, ctx()).cautions.some((x) => x.includes('outside their stated availability'))).toBe(true)
  })

  it('a themed CCF beats one where a single member shares the interest', () => {
    const c = convert({ interests: ['football'] })
    const themed = profile(unit('T'), fans(6))
    const oneFan = profile(unit('O'), [person({ interests: ['football'] }), ...fans(5, { interests: ['music'] })])
    expect(factor(scorePair(c, themed, ctx()), 'interests')).toBe(100)
    expect(factor(scorePair(c, oneFan, ctx()), 'interests')!).toBeLessThan(40)
  })

  it('catch-all options never count as shared', () => {
    const p = profile(unit('A'), fans(3, { interests: ['other'] }))
    expect(factor(scorePair(convert({ interests: ['other'] }), p, ctx()), 'interests')).toBeNull()
    expect(factor(scorePair(convert({ occupation: 'other' }), profile(unit('B'), fans(2, { occupation: 'other' } as never)), ctx()), 'profession')).toBeNull()
  })

  it('a mixed-age group is not a false age fit', () => {
    const mixed = profile(unit('A'), [person({}, { age: 18 }), person({}, { age: 50 })])
    expect(factor(scorePair(convert({}, { age: 34 }), mixed, ctx()), 'age')).toBe(20)
  })

  it('age is a profile fit, never a rule: a young convert is ranked towards the CCF of people their age', () => {
    const older = profile(unit('OL'), [person({}, { age: 45 }), person({}, { age: 48 })])
    const younger = profile(unit('YO'), [person({}, { age: 16 }), person({}, { age: 17 })])
    const ranked = rankUnits(convert({}, { age: 17 }), [older, younger], ctx())
    expect(ranked.top.map((u) => u.ccfCode)).toEqual(['YO', 'OL']) // both eligible
    expect(ranked.ineligible).toHaveLength(0)
  })

  it('does not flag an age a year or two outside a narrow range', () => {
    const sameAge = profile(unit('A'), [person({}, { age: 29 }), person({}, { age: 29 })])
    const near = scorePair(convert({}, { age: 28 }), sameAge, ctx())
    expect(near.cautions.some((c) => c.startsWith('Outside the age range'))).toBe(false)
    const far = scorePair(convert({}, { age: 40 }), sameAge, ctx())
    expect(far.cautions.some((c) => c.startsWith('Outside the age range'))).toBe(true)
  })

  it('missing DOB warns that the safeguard could not apply', () => {
    const r = rankUnits(convert({}, { age: null }), [profile(unit('A'), [person()])], ctx())
    expect(r.warnings[0]).toMatch(/Date of birth is missing/)
  })

  it('weights renormalise over the factors that apply', () => {
    const r = scorePair(convert({}, { age: null }), profile(unit('A'), [person()]), ctx())
    expect(r.overall).toBe(100) // only location applies
  })
})

// ---------------------------------------------------------------------------
// v2 behaviour: hierarchy, smoothing, reserved seats, weights
// ---------------------------------------------------------------------------
describe('CCF profiles within a CCG', () => {
  it('an empty CCF borrows its CCG profile', () => {
    const sibling = fans(6)
    const empty = profile(unit('NEW'), [], { ccgMembers: sibling })
    const r = scorePair(convert({ interests: ['football'] }), empty, ctx())
    expect(factor(r, 'interests')).toBe(100)
    expect(r.cautions).toContain('No members yet — profile is based on its CCG')
  })

  it('a large CCF barely moves toward its CCG', () => {
    const own = fans(30, { interests: ['music'] })
    const sibling = fans(30)
    const p = profile(unit('BIG'), own, { ccgMembers: [...own, ...sibling] })
    const r = scorePair(convert({ interests: ['football'] }), p, ctx())
    expect(factor(r, 'interests')!).toBeLessThan(10)
  })

  it('smoothing can be turned off', () => {
    const config = resolveCcgConfig({ smoothing: 0 })
    const p = profile(unit('NEW'), [], { ccgMembers: fans(6), config })
    expect(factor(scorePair(convert({ interests: ['football'] }), p, ctx(config)), 'interests')).toBe(0)
  })

  it('an empty CCF uses its CCG ages for age fit', () => {
    const p = profile(unit('NEW'), [], { ccgMembers: [person({}, { age: 30 })] })
    expect(p.ageSource).toBe('ccg')
    expect(factor(scorePair(convert({}, { age: 30 }), p, ctx()), 'age')).toBe(100)
  })
})

describe('capacity and reserved seats', () => {
  it('active placements take seats', () => {
    const p = profile(unit('A', { capacity: 4 }), [person(), person()], { activePlacements: 2 })
    expect(rankUnits(convert(), [p], ctx()).ineligible[0].ineligibleReasons).toEqual(['full'])
  })

  it('pending proposals hold the last seats, spreading a burst of converts', () => {
    const c = convert({ interests: ['football'] })
    const best = profile(unit('BEST', { capacity: 4 }), fans(3), { reserved: 1 })
    const next = profile(unit('NEXT'), [person({ interests: ['football'] }), person()])
    const r = rankUnits(c, [best, next], ctx())
    expect(r.top[0].ccfCode).toBe('NEXT')
    expect(r.ineligible[0].ineligibleReasons).toEqual(['reserved'])
  })

  it('an inactive CCG makes its CCFs ineligible', () => {
    const p = profile(unit('A', { ccgStatus: 'paused' }), [person()])
    expect(rankUnits(convert(), [p], ctx()).ineligible[0].ineligibleReasons).toContain('inactive')
  })
})

describe('config', () => {
  it('empty stored config resolves to defaults', () => {
    expect(resolveCcgConfig({})).toEqual(DEFAULT_CCG_CONFIG)
  })
  it('merges a partial override', () => {
    expect(resolveCcgConfig({ location: { different: 20 } }).location).toEqual({ same: 100, different: 20 })
  })
  it('rejects weights that do not total 100', () => {
    expect(resolveCcgConfig({ weights: { interests: 90 } })).toEqual(DEFAULT_CCG_CONFIG)
  })
  it('changing weights changes the score', () => {
    const c = convert({ interests: ['football'] }, { zoneId: 'zone-b' })
    const p = profile(unit('A'), fans(2))
    const heavy = resolveCcgConfig({ weights: { ...DEFAULT_CCG_CONFIG.weights, interests: 5, location: 30 } })
    expect(scorePair(c, p, ctx(heavy)).overall).toBeLessThan(scorePair(c, p, ctx()).overall)
  })
})

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------
describe('validateAnswers', () => {
  const v = (input: Record<string, unknown>, opts: Partial<Parameters<typeof validateAnswers>[2]> = {}) =>
    validateAnswers(QUESTIONS, input, { kind: 'convert', enforceRequired: false, ...opts })

  it('accepts valid answers of every type', () => {
    const r = v({ interests: ['football', 'music'], occupation: 'health', trait_new_people: 4, notes_to_leader: '  hi ' })
    expect(r.ok).toBe(true)
    expect(r.set).toEqual({ interests: ['football', 'music'], occupation: 'health', trait_new_people: 4, notes_to_leader: 'hi' })
  })

  it('rejects unknown questions and options', () => {
    const r = v({ nope: 1, interests: ['knitting'] })
    expect(r.ok).toBe(false)
    expect(r.errors._unknown).toMatch(/nope/)
    expect(r.errors.interests).toMatch(/knitting/)
  })

  it('enforces max choices, scale range and audience', () => {
    const q = QUESTIONS.map((x) => (x.key === 'interests' ? { ...x, maxChoices: 1 } : x))
    expect(validateAnswers(q, { interests: ['football', 'music'] }, { kind: 'convert', enforceRequired: false }).errors.interests).toMatch(/at most 1/)
    expect(v({ trait_new_people: 7 }).errors.trait_new_people).toBeDefined()
    expect(v({ trait_hosting: 3 }).errors.trait_hosting).toMatch(/not asked of converts/)
  })

  it('clears an answer with null or empty', () => {
    expect(v({ interests: [], occupation: null }).cleared).toEqual(['interests', 'occupation'])
  })

  it('enforces required questions on full submissions only', () => {
    expect(v({}, { enforceRequired: true }).errors.interests).toBe('This question is required')
    expect(v({}, { enforceRequired: true, previous: { interests: ['music'] } }).ok).toBe(true)
    expect(v({}).ok).toBe(true)
  })

  it('keeps a deactivated option the person already held', () => {
    const q = QUESTIONS.map((x) =>
      x.key === 'interests' ? { ...x, options: x.options.map((o) => (o.key === 'music' ? { ...o, active: false } : o)) } : x
    )
    const run = (previous?: Record<string, string[]>) =>
      validateAnswers(q, { interests: ['music'] }, { kind: 'convert', enforceRequired: false, previous }).ok
    expect(run()).toBe(false)
    expect(run({ interests: ['music'] })).toBe(true)
  })

  it('knows when a profile is complete', () => {
    expect(isProfileComplete(QUESTIONS, {}, 'convert')).toBe(false)
    expect(isProfileComplete(QUESTIONS, { interests: ['music'] }, 'convert')).toBe(true)
  })
})

describe('signals and helpers', () => {
  it('parses valid signals and rejects malformed ones', () => {
    expect(parseSignal({ type: 'option_share', refs: ['interests:football'] })).not.toBeNull()
    expect(parseSignal({ type: 'option_share', refs: ['football'] })).toBeNull()
    expect(parseSignal({ type: 'trait', questions: [], direction: 'high' })).toBeNull()
  })
  it('maps meeting times onto availability option keys', () => {
    expect(meetingSlotKey('Friday', '6:30 PM')).toBe('weekday_evenings')
    expect(meetingSlotKey('Sunday', '15:00')).toBe('sunday_afternoons')
    expect(meetingSlotKey(null, '15:00')).toBeNull()
  })
  it('computes ages on birthdays correctly', () => {
    const today = new Date(Date.UTC(2026, 8, 22))
    expect(ageOn('2000-09-22', today)).toBe(26)
    expect(ageOn('2000-09-23', today)).toBe(25)
  })
})
