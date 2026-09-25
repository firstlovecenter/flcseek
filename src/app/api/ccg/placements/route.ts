import type { Prisma } from '@prisma/client'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { invalid } from '@/lib/ccg/errors'
import { withCcg } from '@/lib/ccg/server/handler'
import { backfillSummaries } from '@/lib/ccg/server/ai'
import { placementListInclude, placementScopeWhere, serializePlacement } from '@/lib/ccg/server/placement-dto'

export const dynamic = 'force-dynamic'

const STATUSES = ['proposed', 'held', 'active', 'ended', 'superseded']

/**
 * GET /api/ccg/placements?status=proposed&ccf_id=&ccg_id=&limit=&offset=
 * The approval queue (status=proposed, oldest first), held cases, or placement
 * history. Each item carries the match reasons and #2/#3 alternatives.
 */
export const GET = withCcg({ permission: 'placements.view' }, async ({ scope, query }) => {
  const status = query.get('status') ?? 'proposed'
  if (!STATUSES.includes(status)) throw invalid(`status must be one of ${STATUSES.join(', ')}`)
  const ccfId = query.get('ccf_id')
  const ccgId = query.get('ccg_id')
  const limit = Math.min(Number(query.get('limit')) || 50, 200)
  const offset = Math.max(Number(query.get('offset')) || 0, 0)
  const open = status === 'proposed' || status === 'held'
  const unitField = open ? 'proposedCcf' : 'finalCcf'

  const where: Prisma.CcgPlacementWhereInput = {
    status,
    person: { deletedAt: null },
    AND: [
      placementScopeWhere(scope),
      ccfId ? { [open ? 'proposedCcfId' : 'finalCcfId']: ccfId } : {},
      ccgId ? { [unitField]: { ccgId } } : {},
    ],
  }
  const [rows, total] = await Promise.all([
    prisma.ccgPlacement.findMany({
      where,
      include: placementListInclude,
      orderBy: open ? { createdAt: 'asc' } : { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.ccgPlacement.count({ where }),
  ])
  const placements = rows.map((r) => serializePlacement(r))
  // Proposals made before the AI was switched on get their summary now (after the response).
  backfillSummaries(placements)
  return success({ placements }, { total, limit, offset, hasMore: offset + rows.length < total })
})
