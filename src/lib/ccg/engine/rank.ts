import { scorePair, type ScoreContext } from './score'
import type { CcfProfile, EnginePerson, IneligibleReason, RankResult, ScoredUnit } from './types'

export const INELIGIBLE_LABELS: Record<IneligibleReason, string> = {
  full: 'CCF is full',
  reserved: 'Remaining seats are held by proposals awaiting approval',
  inactive: 'CCF or its CCG is not active',
}

export function ineligibleReasons(convert: EnginePerson, profile: CcfProfile): IneligibleReason[] {
  const u = profile.unit
  const reasons: IneligibleReason[] = []
  if (u.status !== 'active' || u.ccgStatus !== 'active') reasons.push('inactive')
  if (profile.occupied >= u.capacity) reasons.push('full')
  else if (profile.occupied + profile.reserved >= u.capacity) reasons.push('reserved')
  return reasons
}

/**
 * Score a convert against every CCF and rank them. Ineligible CCFs are never
 * recommended but are returned so an admin can see why. Proposals awaiting
 * approval hold seats, so a burst of registrations spreads out instead of all
 * landing on one CCF. Ties: overall, then interests, then code.
 */
export function rankUnits(convert: EnginePerson, profiles: CcfProfile[], ctx: ScoreContext, topN = 3): RankResult {
  const warnings: string[] = []
  if (convert.age === null) {
    warnings.push('Date of birth is missing, so age could not be compared with the CCFs’ members.')
  }

  const scored: ScoredUnit[] = profiles.map((p) => {
    const pair = scorePair(convert, p, ctx)
    const why = ineligibleReasons(convert, p)
    return {
      ccfId: p.unit.id,
      ccfCode: p.unit.code,
      ccfName: p.unit.name,
      ccgId: p.unit.ccgId,
      ccgCode: p.unit.ccgCode,
      ccgName: p.unit.ccgName,
      overall: pair.overall,
      factors: pair.factors,
      reasons: pair.reasons,
      cautions: pair.cautions,
      eligible: why.length === 0,
      ineligibleReasons: why,
      availableSpaces: Math.max(0, p.unit.capacity - p.occupied - p.reserved),
      capacity: p.unit.capacity,
      memberCount: p.own.memberCount,
    }
  })

  const interests = (u: ScoredUnit) => u.factors.find((f) => f.factor === 'interests')?.score ?? -1
  scored.sort((a, b) => b.overall - a.overall || interests(b) - interests(a) || a.ccfCode.localeCompare(b.ccfCode))

  const eligible = scored.filter((u) => u.eligible)
  const ineligible = scored.filter((u) => !u.eligible)
  if (profiles.length === 0) warnings.push('No CCFs have been set up yet.')
  else if (eligible.length === 0) warnings.push('No eligible CCF available.')

  return { ranked: scored, eligible, ineligible, top: eligible.slice(0, topN), warnings }
}
