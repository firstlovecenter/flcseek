/**
 * Synthetic fixtures for CCG engine tests. A small question bank shaped like
 * the migration-020 starter bank, plus builders. No real people.
 */
import {
  DEFAULT_CCG_CONFIG,
  aggregateMembers,
  buildCcfProfile,
  type CcgConfig,
  type EngineOption,
  type EnginePerson,
  type EngineQuestion,
  type EngineUnit,
  type Signal,
} from '@/lib/ccg/engine'

const opt = (key: string, extra: Partial<EngineOption> = {}): EngineOption => ({
  key,
  label: key.replace(/_/g, ' '),
  catchAll: false,
  signal: null,
  active: true,
  ...extra,
})

const q = (key: string, extra: Partial<EngineQuestion>): EngineQuestion => ({
  key,
  prompt: key,
  type: 'multi',
  audience: 'both',
  required: false,
  maxChoices: null,
  factor: 'none',
  method: 'none',
  weight: 1,
  active: true,
  options: [],
  ...extra,
})

const pref = (key: string, signal: Signal) => opt(key, { signal })

export const QUESTIONS: EngineQuestion[] = [
  q('interests', {
    maxChoices: 5,
    required: true,
    factor: 'interests',
    method: 'share',
    options: ['football', 'music', 'business', 'technology', 'arts', 'photography', 'cooking', 'reading', 'gym'].map((k) => opt(k)).concat(opt('other', { catchAll: true })),
  }),
  q('activities', {
    factor: 'interests',
    method: 'share',
    weight: 0.5,
    options: ['sports', 'eating_together', 'study', 'volunteering'].map((k) => opt(k)),
  }),
  q('friendship_prefs', {
    audience: 'convert',
    factor: 'friendship',
    method: 'preference',
    options: [
      pref('age', { type: 'age' }),
      pref('similar_interests', { type: 'similar', factor: 'interests' }),
      pref('same_work', { type: 'same_answer', question: 'occupation' }),
      pref('sports', { type: 'option_share', refs: ['interests:football', 'interests:gym', 'activities:sports'] }),
      pref('technology', { type: 'option_share', refs: ['interests:technology'] }),
      pref('social', { type: 'trait', questions: ['trait_group_activity'], direction: 'high' }),
      pref('calm', { type: 'trait', questions: ['trait_group_activity'], direction: 'low' }),
      pref('anyone', { type: 'neutral' }),
    ],
  }),
  q('availability', {
    audience: 'convert',
    factor: 'availability',
    method: 'meeting_slot',
    options: ['weekday_evenings', 'saturday_mornings', 'saturday_afternoons', 'sunday_afternoons'].map((k) => opt(k)),
  }),
  q('trait_new_people', { type: 'scale5', factor: 'social', method: 'distance' }),
  q('trait_group_activity', { type: 'scale5', factor: 'social', method: 'distance' }),
  q('trait_hosting', { type: 'scale5', audience: 'member' }),
  q('occupation', {
    type: 'single',
    factor: 'profession',
    method: 'same_answer',
    options: ['health', 'technology', 'teacher', 'trader'].map((k) => opt(k)).concat(opt('other', { catchAll: true })),
  }),
  q('employment_status', { type: 'single', options: ['full_time', 'student'].map((k) => opt(k)) }),
  q('notes_to_leader', { type: 'text', audience: 'convert' }),
]

let seq = 0
export function person(answers: EnginePerson['answers'] = {}, extra: Partial<EnginePerson> = {}): EnginePerson {
  seq += 1
  return {
    id: `p-${seq}`,
    kind: 'member',
    gender: null,
    age: 28,
    zoneId: 'zone-a',
    existingConnectionMemberId: null,
    ...extra,
    answers,
  }
}
export const convert = (answers: EnginePerson['answers'] = {}, extra: Partial<EnginePerson> = {}) =>
  person(answers, { kind: 'convert', ...extra })

export function unit(code: string, extra: Partial<EngineUnit> = {}): EngineUnit {
  return {
    id: `ccf-${code}`,
    code,
    name: `CCF ${code}`,
    ccgId: 'ccg-1',
    ccgCode: 'G1',
    ccgName: 'CCG One',
    zoneId: 'zone-a',
    zoneLabel: 'Zone A',
    meetingDay: 'Monday',
    meetingTime: '19:00',
    capacity: 10,
    status: 'active',
    ccgStatus: 'active',
    audience: 'adult',
    ...extra,
  }
}

/**
 * Build CCF profiles. `ccgMembers` defaults to the CCF's own members, i.e. a
 * CCG containing only this CCF (smoothing then changes nothing).
 */
export function profile(
  u: EngineUnit,
  members: EnginePerson[],
  opts: { activePlacements?: number; reserved?: number; ccgMembers?: EnginePerson[]; config?: CcgConfig } = {}
) {
  const config = opts.config ?? DEFAULT_CCG_CONFIG
  return buildCcfProfile(
    {
      unit: u,
      members,
      ccgAggregate: aggregateMembers(opts.ccgMembers ?? members, QUESTIONS),
      activePlacements: opts.activePlacements ?? 0,
      reserved: opts.reserved ?? 0,
    },
    QUESTIONS,
    config
  )
}

export const ctx = (config: CcgConfig = DEFAULT_CCG_CONFIG) => ({ config, questions: QUESTIONS })

export function factor(r: { factors: { factor: string; score: number | null }[] }, f: string) {
  return r.factors.find((x) => x.factor === f)!.score
}
