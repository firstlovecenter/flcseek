import { success } from '@/lib/api/response'
import { invalid } from '@/lib/ccg/errors'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { canSeeUnit, ccfIdsIn, isUnitType } from '@/lib/ccg/server/unit-overview'
import { attendanceTrend } from '@/lib/ccg/server/weekly'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/trends?series=sunday|fellowship&unit_type=&unit_id=&weeks=5&offset=0
 * Weekly attendance of placed converts, for the unit in focus or everything
 * in scope. `offset` pages back through time, `weeks` at a time.
 */
export const GET = withCcg({ permission: 'reports.view' }, async ({ scope, query }) => {
  const series = query.get('series') === 'fellowship' ? 'fellowship' : 'sunday'
  const weeks = Math.min(Math.max(Number(query.get('weeks')) || 5, 1), 26)
  const offset = Math.max(Number(query.get('offset')) || 0, 0)
  const type = query.get('unit_type')
  const id = query.get('unit_id')
  const inScope = scope.ccfIds('reports.view')
  let ccfIds = inScope
  if (type && id) {
    if (!isUnitType(type)) throw invalid('unit_type must be stream, council, ccg or ccf')
    ensure(canSeeUnit(scope, type, id), 'You can only view units in your scope')
    const unit = await ccfIdsIn(type, id)
    ccfIds = inScope === 'all' ? unit : unit.filter((x) => inScope.includes(x))
  }
  return success(await attendanceTrend(ccfIds, series, weeks, offset))
})
