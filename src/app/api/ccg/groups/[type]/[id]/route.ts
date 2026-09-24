import { success } from '@/lib/api/response'
import { invalid } from '@/lib/ccg/errors'
import { withCcg } from '@/lib/ccg/server/handler'
import { isUnitType, unitOverview } from '@/lib/ccg/server/unit-overview'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/groups/[type]/[id]?history=5 — a stream, council, CCG or CCF's
 * page: breadcrumb, leaders and role holders, stat tiles, sub-groups and history.
 */
export const GET = withCcg<undefined, { type: string; id: string }>({}, async ({ scope, params, query }) => {
  if (!isUnitType(params.type)) throw invalid('Unknown unit type')
  const limit = Math.min(Math.max(Number(query.get('history')) || 5, 1), 100)
  return success(await unitOverview(scope, params.type, params.id, limit))
})
