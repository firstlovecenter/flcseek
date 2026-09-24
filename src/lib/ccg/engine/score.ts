import { FACTORS, QUESTION_FACTORS, type CcgConfig, type Factor } from './config'
import { blendedUnionShare, chosenOptions } from './profile'
import { scoreSignal, type SignalContext } from './signals'
import type { CcfProfile, EnginePerson, EngineQuestion, FactorResult } from './types'

/**
 * Score one convert against one CCF profile.
 *
 * Question-driven factors: each scored question is scored by its method; the
 * factor is the weighted mean of its questions. Age, location and connection
 * come from core fields. Factors with no data are left out and the remaining
 * weights renormalised, so a skipped question neither penalises nor inflates.
 */

export interface PairScore {
  factors: FactorResult[]
  overall: number
  reasons: string[]
  cautions: string[]
}

export interface ScoreContext {
  config: CcgConfig
  questions: EngineQuestion[]
}

const round1 = (x: number) => Math.round(x * 10) / 10
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export function ageBandScore(diff: number, config: CcgConfig): number {
  const band = config.ageBands.find((b) => diff <= b.maxDiff)
  return (band ?? config.ageBands[config.ageBands.length - 1]).score
}

/**
 * Mean age gap between the convert and each member (CCF, else CCG). Unlike
 * distance to the group's mean, a mixed group of 18- and 50-year-olds is not
 * a "perfect fit" for a 34-year-old.
 */
function scoreAge(convert: EnginePerson, profile: CcfProfile, config: CcgConfig): number | null {
  if (convert.age === null) return null
  const ages = profile.ageSource === 'ccf' ? profile.own.ages : profile.ageSource === 'ccg' ? profile.ccg.ages : []
  if (ages.length === 0) return null
  const age = convert.age
  return ageBandScore(ages.reduce((s, a) => s + Math.abs(a - age), 0) / ages.length, config)
}

function share(profile: CcfProfile, q: EngineQuestion, option: string): number {
  const agg = profile.blended[q.key]
  return agg?.kind === 'choice' ? agg.shares[option] ?? 0 : 0
}

interface QuestionScore {
  q: EngineQuestion
  score: number
  /** Option labels the convert shares strongly with the group (for reasons). */
  shared?: string[]
}

function scoreQuestion(
  q: EngineQuestion,
  convert: EnginePerson,
  profile: CcfProfile,
  ctx: ScoreContext,
  signalCtx: () => SignalContext
): QuestionScore | null {
  const { config } = ctx
  const value = convert.answers[q.key]
  if (value === undefined) return null

  switch (q.method) {
    case 'share': {
      const picked = chosenOptions(q, value)
      if (picked.length === 0) return null
      const hits = picked.map((k) => clamp01(share(profile, q, k) / config.targetShare))
      const shared = picked
        .filter((k) => share(profile, q, k) >= config.targetShare / 2)
        .sort((a, b) => share(profile, q, b) - share(profile, q, a))
        .map((k) => q.options.find((o) => o.key === k)?.label ?? k)
      return { q, score: (hits.reduce((a, b) => a + b, 0) / hits.length) * 100, shared }
    }
    case 'same_answer': {
      const picked = chosenOptions(q, value)
      if (picked.length === 0) return null
      const any = picked.some((k) => share(profile, q, k) > 0)
      return { q, score: any ? config.sameAnswer.match : config.sameAnswer.noMatch }
    }
    case 'distance': {
      const agg = profile.blended[q.key]
      if (typeof value !== 'number' || agg?.kind !== 'scale' || agg.mean === null) return null
      return { q, score: Math.max(0, 100 - Math.abs(value - agg.mean) * 25) }
    }
    case 'meeting_slot': {
      const picked = chosenOptions(q, value)
      if (picked.length === 0 || !profile.meetingSlotKey) return null
      return {
        q,
        score: picked.includes(profile.meetingSlotKey) ? config.availability.match : config.availability.noMatch,
      }
    }
    case 'preference': {
      const picked = chosenOptions(q, value)
      const sctx = signalCtx()
      const scores = picked
        .map((k) => q.options.find((o) => o.key === k)?.signal ?? null)
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => scoreSignal(s, sctx))
        .filter((s): s is number => s !== null)
      if (scores.length === 0) return null
      return { q, score: scores.reduce((a, b) => a + b, 0) / scores.length }
    }
    default:
      return null
  }
}

function weightedMean(items: QuestionScore[]): number | null {
  const total = items.reduce((s, i) => s + i.q.weight, 0)
  if (total <= 0) return null
  return items.reduce((s, i) => s + i.score * i.q.weight, 0) / total
}

export function scorePair(convert: EnginePerson, profile: CcfProfile, ctx: ScoreContext): PairScore {
  const { config } = ctx
  const questions = ctx.questions.filter((q) => q.active && q.factor !== 'none' && q.method !== 'none')
  const scores = {} as Record<Factor, number | null>
  const byFactor = new Map<string, QuestionScore[]>()

  scores.age = scoreAge(convert, profile, config)

  // Non-preference questions first: preferences may depend on their factors.
  const signalCtx = (): SignalContext => ({
    config,
    unionShare: (refs) => blendedUnionShare(profile, refs, config.smoothing),
    scaleMean: (key) => {
      const a = profile.blended[key]
      return a?.kind === 'scale' ? a.mean : null
    },
    optionShare: (key, option) => {
      const a = profile.blended[key]
      return a?.kind === 'choice' ? a.shares[option] ?? 0 : 0
    },
    convertAnswer: (key) => {
      const q = ctx.questions.find((x) => x.key === key)
      return q ? chosenOptions(q, convert.answers[key])[0] ?? null : null
    },
    ageScore: scores.age,
    factorScore: (f) => (f in scores ? scores[f as Factor] : null),
    hasMembers: profile.own.memberCount + profile.ccg.memberCount > 0,
  })

  const add = (s: QuestionScore | null) => {
    if (!s) return
    byFactor.set(s.q.factor, [...(byFactor.get(s.q.factor) ?? []), s])
  }
  // Pass 1: every non-preference question, then provisional factor scores
  // (a 'similar' preference reads them).
  for (const q of questions) if (q.method !== 'preference') add(scoreQuestion(q, convert, profile, ctx, signalCtx))
  for (const f of QUESTION_FACTORS) scores[f] = weightedMean(byFactor.get(f) ?? [])
  // Pass 2: preferences, then final factor scores.
  for (const q of questions) if (q.method === 'preference') add(scoreQuestion(q, convert, profile, ctx, signalCtx))
  for (const f of QUESTION_FACTORS) scores[f] = weightedMean(byFactor.get(f) ?? [])

  scores.location =
    convert.zoneId && profile.unit.zoneId
      ? convert.zoneId === profile.unit.zoneId
        ? config.location.same
        : config.location.different
      : null

  scores.connection = convert.existingConnectionMemberId
    ? profile.own.memberIds.includes(convert.existingConnectionMemberId)
      ? config.connection.inGroup
      : config.connection.notInGroup
    : null

  const factors: FactorResult[] = FACTORS.map((factor) => ({
    factor,
    score: scores[factor] === null ? null : round1(scores[factor] as number),
    weight: config.weights[factor],
  }))
  const applicable = factors.filter((f) => f.score !== null && f.weight > 0)
  const totalWeight = applicable.reduce((a, f) => a + f.weight, 0)
  const overall = totalWeight
    ? round1(applicable.reduce((a, f) => a + (f.score as number) * f.weight, 0) / totalWeight)
    : 0

  const shared = (byFactor.get('interests') ?? []).flatMap((s) => s.shared ?? [])
  return { factors, overall, ...explain(convert, profile, scores, shared, config) }
}

function explain(
  convert: EnginePerson,
  profile: CcfProfile,
  s: Record<Factor, number | null>,
  sharedInterests: string[],
  config: CcgConfig
) {
  const t = config.reasonThresholds
  const reasons: string[] = []
  const cautions: string[] = []
  const hit = (f: Factor) => s[f] !== null && (s[f] as number) >= t[f]

  if (hit('connection')) reasons.push('Already knows someone in this CCF')
  if (hit('interests')) {
    const top = [...new Set(sharedInterests)].slice(0, 3)
    reasons.push(top.length ? `Strong shared interests: ${top.join(', ')}` : 'Strong shared interests')
  }
  if (hit('age') && profile.medianAge !== null) {
    reasons.push(`Similar age / life stage (median ${Math.round(profile.medianAge)})`)
  }
  if (hit('social')) reasons.push('Similar social style')
  if (hit('friendship')) reasons.push('Fits the kind of friends they are looking for')
  if (hit('availability') && profile.meetingSlotLabel) reasons.push(`Meets when they are free (${profile.meetingSlotLabel})`)
  if (hit('location')) reasons.push(profile.unit.zoneLabel ? `Same zone (${profile.unit.zoneLabel})` : 'Same zone')
  if (hit('profession')) reasons.push('Has members in the same line of work')

  const n = profile.own.memberCount
  if (n === 0) cautions.push('No members yet — profile is based on its CCG')
  else if (n < config.minMembers) cautions.push(`Only ${n} member${n === 1 ? '' : 's'} — profile leans on its CCG`)
  if (s.availability !== null && s.availability < config.availability.match && profile.meetingSlotLabel) {
    cautions.push(`Meets ${profile.meetingSlotLabel.toLowerCase()}, outside their stated availability`)
  }
  if (s.location !== null && s.location < config.location.same) cautions.push('Different zone')
  // Only flag a real gap: within the closest age band of the range still counts as in range.
  const slack = config.ageBands[0]?.maxDiff ?? 0
  if (
    convert.age !== null &&
    profile.minAge !== null &&
    profile.maxAge !== null &&
    (convert.age < profile.minAge - slack || convert.age > profile.maxAge + slack)
  ) {
    cautions.push(`Outside the age range (${profile.minAge}–${profile.maxAge})`)
  }
  return { reasons, cautions }
}
