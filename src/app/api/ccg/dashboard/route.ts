import { success } from '@/lib/api/response'
import { invalid } from '@/lib/ccg/errors'
import { parseMonth } from '@/lib/ccg/server/cohort'
import { dashboard } from '@/lib/ccg/server/dashboard'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { canSeeUnit, isUnitType } from '@/lib/ccg/server/unit-overview'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/dashboard?unit_type=&unit_id=&month= — numbers for the units the
 * viewer reports on, narrowed to the unit in focus ("church in focus") when
 * given, with this week's duties for it. `month` (yyyy-mm) counts only that
 * month's converts.
 */
export const GET = withCcg({ permission: 'reports.view' }, async ({ scope, query }) => {
  const type = query.get('unit_type')
  const id = query.get('unit_id')
  const month = parseMonth(query.get('month'))
  if (!type || !id) return success(await dashboard(scope, null, month))
  if (!isUnitType(type)) throw invalid('unit_type must be campus, stream, council, ccg or ccf')
  ensure(canSeeUnit(scope, type, id), 'You can only view units in your scope')
  return success(await dashboard(scope, { type, id }, month))
})
