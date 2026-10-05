import { success } from '@/lib/api/response'
import { invalid } from '@/lib/ccg/errors'
import { convertMonths } from '@/lib/ccg/server/cohort'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { canSeeUnit, isUnitType } from '@/lib/ccg/server/unit-overview'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/months?unit_type=&unit_id= — the months whose converts are in
 * their assessment year in the unit, newest first, with how many (Seek's
 * monthly groups).
 */
export const GET = withCcg({ permission: 'reports.view' }, async ({ scope, query }) => {
  const type = query.get('unit_type')
  const id = query.get('unit_id')
  if (!type || !id) return success(await convertMonths(scope, null))
  if (!isUnitType(type)) throw invalid('unit_type must be campus, stream, council, ccg or ccf')
  ensure(canSeeUnit(scope, type, id), 'You can only view units in your scope')
  return success(await convertMonths(scope, { type, id }))
})
