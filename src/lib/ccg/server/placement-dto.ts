import type { Prisma } from '@prisma/client'
import { ageOn } from '../engine'
import type { Permission } from '../permissions'
import { inFilter, type CcgScope } from '../scope'
import { iso, num } from './common'
import type { StoredMatchResults } from './mapping'

export const placementListInclude = {
  person: { select: { id: true, fullName: true, refCode: true, phone: true, dateOfBirth: true, status: true, possibleDuplicateOfId: true } },
  proposedCcf: { include: { ccg: true } },
  finalCcf: { include: { ccg: true } },
  matchRun: { select: { id: true, trigger: true, results: true, createdAt: true } },
} satisfies Prisma.CcgPlacementInclude

type Row = Prisma.CcgPlacementGetPayload<{ include: typeof placementListInclude }>

const unit = (f: Row['proposedCcf']) =>
  f ? { id: f.id, code: f.code, name: f.name, capacity: f.capacity, ccg: { id: f.ccg.id, code: f.ccg.code, name: f.ccg.name } } : null

const DAY = 86_400_000

export function serializePlacement(p: Row, opts: { withAlternatives?: boolean } = {}) {
  const results = p.matchRun?.results as unknown as StoredMatchResults | undefined
  return {
    id: p.id,
    status: p.status,
    person: {
      id: p.person.id,
      full_name: p.person.fullName,
      ref_code: p.person.refCode,
      phone: p.person.phone,
      age: ageOn(p.person.dateOfBirth),
      status: p.person.status,
      possible_duplicate: !!p.person.possibleDuplicateOfId,
    },
    proposed_ccf: unit(p.proposedCcf),
    proposed_score: num(p.proposedScore),
    final_ccf: unit(p.finalCcf),
    final_score: num(p.finalScore),
    decision: p.decision,
    override_reason: p.overrideReason,
    full_ccf_override: p.fullCcfOverride,
    hold_reason: p.holdReason,
    /** Plain-English "why this CCF" for approvers (AI); null until written or when the AI is off. */
    ai_summary: p.aiSummary,
    ai_summary_at: iso(p.aiSummaryAt),
    decided_at: iso(p.decidedAt),
    ended_at: iso(p.endedAt),
    end_reason: p.endReason,
    created_at: iso(p.createdAt),
    waiting_days: p.status === 'proposed' || p.status === 'held' ? Math.floor((Date.now() - (p.createdAt?.getTime() ?? Date.now())) / DAY) : null,
    match: results
      ? {
          run_id: p.matchRun!.id,
          trigger: p.matchRun!.trigger,
          scored_at: iso(p.matchRun!.createdAt),
          warnings: results.warnings,
          /** The proposed CCF's reasons and cautions. */
          proposed: results.top[0] ?? null,
          /** Alternatives for remapping (#2, #3). */
          alternatives: opts.withAlternatives === false ? undefined : results.top.slice(1),
        }
      : null,
  }
}

/**
 * Placements the viewer may see (placements.view): by CCF, or by the stream
 * that registered the convert (stream-level Sheep Seekers see held cases too).
 */
export function placementScopeWhere(scope: CcgScope, perm: Permission = 'placements.view'): Prisma.CcgPlacementWhereInput {
  const ids = scope.ccfIds(perm)
  if (ids === 'all') return {}
  const within = inFilter(ids)!
  const streams = scope.streamIds(perm) as string[]
  return {
    OR: [
      { finalCcfId: within },
      { status: { in: ['proposed', 'held'] }, proposedCcfId: within },
      ...(streams.length ? [{ person: { streamId: { in: streams } } }] : []),
    ],
  }
}
