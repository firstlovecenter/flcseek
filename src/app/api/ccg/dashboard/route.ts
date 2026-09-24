import { success } from '@/lib/api/response'
import { invalid } from '@/lib/ccg/errors'
import { dashboard } from '@/lib/ccg/server/dashboard'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { canSeeUnit, isUnitType } from '@/lib/ccg/server/unit-overview'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/dashboard?unit_type=&unit_id= — numbers for the units the
 * viewer reports on, narrowed to the unit in focus ("church in focus") when
 * given, with this week's duties for it.
 */
export const GET = withCcg({ permission: 'reports.view' }, async ({ scope, query }) => {
  const type = query.get('unit_type')
  const id = query.get('unit_id')
  if (!type || !id) return success(await dashboard(scope))
  if (!isUnitType(type)) throw invalid('unit_type must be stream, council, ccg or ccf')
  ensure(canSeeUnit(scope, type, id), 'You can only view units in your scope')
  return success(await dashboard(scope, { type, id }))
})
