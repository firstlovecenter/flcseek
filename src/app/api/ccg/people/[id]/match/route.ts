import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { invalid, notFound } from '@/lib/ccg/errors'
import type { CcgScope } from '@/lib/ccg/scope'
import { iso } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { proposeFor, scoreConvert, serializeScored, type StoredMatchResults } from '@/lib/ccg/server/mapping'

export const dynamic = 'force-dynamic'
type P = { id: string }

/**
 * GET /api/ccg/people/[id]/match — the latest stored run (what the proposal
 * was based on). With ?live=1, scores now without saving (a preview).
 */
/** Full results: the central team, or the Sheep Seekers of the convert's stream. */
async function canSeeMatch(scope: CcgScope, perm: 'placements.view' | 'placements.approve', personId: string) {
  if (scope.can(perm)) return true
  const p = await prisma.ccgPerson.findFirst({ where: { id: personId, deletedAt: null }, select: { streamId: true } })
  return scope.canOnStream(perm, p?.streamId)
}

export const GET = withCcg<undefined, P>({ permission: 'placements.view' }, async ({ scope, params, query }) => {
  ensure(await canSeeMatch(scope, 'placements.view', params.id), 'Only the central team or the stream can see full match results')
  if (query.get('live') === '1') {
    const { person, result } = await scoreConvert(params.id)
    if (person.kind !== 'convert') throw invalid('Only converts are matched')
    return success({
      live: true,
      top: result.top.map(serializeScored),
      eligible: result.eligible.map(serializeScored),
      ineligible: result.ineligible.map(serializeScored),
      warnings: result.warnings,
    })
  }
  const run = await prisma.ccgMatchRun.findFirst({ where: { personId: params.id }, orderBy: { createdAt: 'desc' } })
  if (!run) return success({ run: null })
  return success({ run: { id: run.id, trigger: run.trigger, created_at: iso(run.createdAt), ...(run.results as unknown as StoredMatchResults) } })
})

/** POST /api/ccg/people/[id]/match — re-run matching now and replace the open proposal. */
export const POST = withCcg<undefined, P>({ permission: 'placements.approve' }, async ({ user, scope, params }) => {
  ensure(await canSeeMatch(scope, 'placements.approve', params.id))
  const p = await prisma.ccgPerson.findFirst({ where: { id: params.id, deletedAt: null } })
  if (!p) throw notFound('Person')
  if (p.kind !== 'convert') throw invalid('Only converts are matched')
  const r = await proposeFor(p.id, 'manual', user.id)
  if (!r) throw invalid(`This convert is ${p.status}; end their placement first to re-match`)
  return success({ placement_id: r.placement.id, status: r.placement.status, ccf_id: r.placement.proposedCcfId, match_run_id: r.run.id })
})
