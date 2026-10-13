import { success } from '@/lib/api/response'
import { invalid } from '@/lib/ccg/errors'
import { withCcg } from '@/lib/ccg/server/handler'
import { canAppointAdmins, canSetLeader } from '@/lib/ccg/server/admin-access'
import { isAdminLevel } from '@/lib/ccg/server/roles'
import { isUnitType, unitOverview } from '@/lib/ccg/server/unit-overview'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/groups/[type]/[id]?history=5 — a campus, stream, CCG or CCF's
 * page: breadcrumb, leaders and role holders, stat tiles, sub-groups, history,
 * and whether the viewer may change its leader or appoint its admins.
 */
export const GET = withCcg<undefined, { type: string; id: string }>({}, async ({ scope, params, query }) => {
  const type = params.type
  if (!isUnitType(type)) throw invalid('Unknown unit type')
  const limit = Math.min(Math.max(Number(query.get('history')) || 5, 1), 100)
  const overview = await unitOverview(scope, type, params.id, limit)
  return success({
    ...overview,
    can: {
      set_leader: await canSetLeader(scope, type, params.id),
      appoint_admins: isAdminLevel(type) && canAppointAdmins(scope, type, params.id),
    },
  })
})
