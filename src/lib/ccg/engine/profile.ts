import type { CcgConfig } from './config'
import { meetingSlot, meetingSlotKey } from './meeting-slot'
import type {
  CapacityStatus,
  CcfProfile,
  EnginePerson,
  EngineQuestion,
  EngineUnit,
  MemberAggregate,
  QuestionAggregate,
  RelationshipHealth,
} from './types'

/** Whole years between a date of birth and `today` (UTC dates). */
export function ageOn(dob: Date | string | null | undefined, today: Date = new Date()): number | null {
  if (!dob) return null
  const d = typeof dob === 'string' ? new Date(dob) : dob
  if (Number.isNaN(d.getTime())) return null
  let age = today.getUTCFullYear() - d.getUTCFullYear()
  const beforeBirthday =
    today.getUTCMonth() < d.getUTCMonth() ||
    (today.getUTCMonth() === d.getUTCMonth() && today.getUTCDate() < d.getUTCDate())
  if (beforeBirthday) age -= 1
  return age >= 0 && age < 130 ? age : null
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Option keys a person holds for a choice question, catch-all options excluded. */
export function chosenOptions(q: EngineQuestion, value: unknown): string[] {
  const keys = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  const catchAll = new Set(q.options.filter((o) => o.catchAll).map((o) => o.key))
  return [...new Set(keys.filter((k): k is string => typeof k === 'string' && !catchAll.has(k)))]
}

const isChoice = (q: EngineQuestion) => q.type === 'single' || q.type === 'multi'

/** Aggregate the scored questions over a set of members. */
export function aggregateMembers(members: EnginePerson[], questions: EngineQuestion[]): MemberAggregate {
  const aggregates: Record<string, QuestionAggregate> = {}
  const memberTags: string[][] = members.map(() => [])

  for (const q of questions) {
    if (!q.active) continue
    if (isChoice(q)) {
      const counts = new Map<string, number>()
      let n = 0
      members.forEach((m, i) => {
        if (!(q.key in m.answers)) return
        n++
        for (const k of chosenOptions(q, m.answers[q.key])) {
          counts.set(k, (counts.get(k) ?? 0) + 1)
          memberTags[i].push(`${q.key}:${k}`)
        }
      })
      const shares: Record<string, number> = {}
      for (const [k, c] of counts) shares[k] = n ? c / n : 0
      aggregates[q.key] = { kind: 'choice', n, shares }
    } else if (q.type === 'scale5') {
      const vals = members.map((m) => m.answers[q.key]).filter((v): v is number => typeof v === 'number')
      aggregates[q.key] = { kind: 'scale', n: vals.length, mean: mean(vals) }
    }
  }

  const genderMix = { male: 0, female: 0, unknown: 0 }
  for (const m of members) {
    if (m.gender === 'Male') genderMix.male++
    else if (m.gender === 'Female') genderMix.female++
    else genderMix.unknown++
  }

  return {
    memberCount: members.length,
    memberIds: members.map((m) => m.id),
    memberTags,
    ages: members
      .map((m) => m.age)
      .filter((a): a is number => typeof a === 'number')
      .sort((a, b) => a - b),
    genderMix,
    questions: aggregates,
  }
}

/**
 * Blend a CCF aggregate with its CCG's: (n·ccf + k·ccg)/(n+k). A new or tiny
 * CCF leans on its CCG; an established one speaks for itself.
 */
export function blendAggregate(
  own: QuestionAggregate | undefined,
  parent: QuestionAggregate | undefined,
  k: number
): QuestionAggregate | undefined {
  if (!own) return parent
  if (!parent || k <= 0 || parent.n === 0) return own
  const n = own.n
  const w = (a: number, b: number) => (n * a + k * b) / (n + k)
  if (own.kind === 'choice' && parent.kind === 'choice') {
    const shares: Record<string, number> = {}
    for (const key of new Set([...Object.keys(own.shares), ...Object.keys(parent.shares)])) {
      shares[key] = w(own.shares[key] ?? 0, parent.shares[key] ?? 0)
    }
    return { kind: 'choice', n: n + k, shares }
  }
  if (own.kind === 'scale' && parent.kind === 'scale') {
    if (own.mean === null) return parent
    if (parent.mean === null) return own
    return { kind: 'scale', n: n + k, mean: w(own.mean, parent.mean) }
  }
  return own
}

export function capacityStatusFor(memberCount: number, occupied: number, capacity: number, minMembers: number): CapacityStatus {
  if (occupied >= capacity) return 'full'
  if (memberCount < minMembers) return 'below_minimum'
  if (capacity - occupied <= 1 || occupied / capacity >= 0.8) return 'near_capacity'
  return 'healthy'
}

/** Critical under the minimum member count; needs attention when members rate themselves low socially. */
export function relationshipHealthFor(memberCount: number, socialMean: number | null, minMembers: number): RelationshipHealth {
  if (memberCount < minMembers) return 'critical'
  if (socialMean !== null && socialMean < 3.5) return 'needs_attention'
  return 'healthy'
}

export interface ProfileInput {
  unit: EngineUnit
  members: EnginePerson[]
  /** Pre-computed aggregate over every active member of this CCF's CCG. */
  ccgAggregate: MemberAggregate
  /** Converts with an active placement in this CCF. */
  activePlacements: number
  /** Open proposals for this CCF (excluding the person being matched). */
  reserved: number
}

export function buildCcfProfile(input: ProfileInput, questions: EngineQuestion[], config: CcgConfig): CcfProfile {
  const own = aggregateMembers(input.members, questions)
  const ccg = input.ccgAggregate

  const blended: Record<string, QuestionAggregate> = {}
  for (const q of questions) {
    const b = blendAggregate(own.questions[q.key], ccg.questions[q.key], config.smoothing)
    if (b) blended[q.key] = b
  }

  const ageSource = own.ages.length ? 'ccf' : ccg.ages.length ? 'ccg' : 'none'
  const ages = ageSource === 'ccf' ? own.ages : ageSource === 'ccg' ? ccg.ages : []

  const socialMeans = questions
    .filter((q) => q.active && q.factor === 'social' && q.type === 'scale5')
    .map((q) => blended[q.key])
    .map((a) => (a?.kind === 'scale' ? a.mean : null))
    .filter((m): m is number => m !== null)
  const socialMean = socialMeans.length ? socialMeans.reduce((a, b) => a + b, 0) / socialMeans.length : null

  const occupied = own.memberCount + input.activePlacements
  return {
    unit: input.unit,
    own,
    ccg,
    blended,
    ageSource,
    medianAge: median(ages),
    minAge: ages.length ? ages[0] : null,
    maxAge: ages.length ? ages[ages.length - 1] : null,
    occupied,
    reserved: input.reserved,
    availableSpaces: Math.max(0, input.unit.capacity - occupied),
    meetingSlotKey: meetingSlotKey(input.unit.meetingDay, input.unit.meetingTime),
    meetingSlotLabel: meetingSlot(input.unit.meetingDay, input.unit.meetingTime),
    capacityStatus: capacityStatusFor(own.memberCount, occupied, input.unit.capacity, config.minMembers),
    health: relationshipHealthFor(own.memberCount, socialMean, config.minMembers),
    socialMean,
  }
}

/** Share of members holding any of `refs`, from one aggregate. */
export function unionShareOf(agg: MemberAggregate, refs: string[]): number {
  if (agg.memberCount === 0) return 0
  const set = new Set(refs)
  return agg.memberTags.filter((tags) => tags.some((t) => set.has(t))).length / agg.memberCount
}

/** Blended union share for a CCF profile. */
export function blendedUnionShare(profile: CcfProfile, refs: string[], k: number): number {
  const n = profile.own.memberCount
  const own = unionShareOf(profile.own, refs)
  if (k <= 0 || profile.ccg.memberCount === 0) return own
  return (n * own + k * unionShareOf(profile.ccg, refs)) / (n + k)
}
