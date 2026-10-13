import { success } from '@/lib/api/response'
import { invalid } from '@/lib/ccg/errors'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { canSeeUnit, drillChildren, isUnitType } from '@/lib/ccg/server/unit-overview'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/units/children?portal=ccg|seeking&unit_type=&unit_id= — the units
 * one level below a unit (the top of the tree without one) that the viewer can
 * drill into: `{ items[{ type, id, name }] }`. Sheep Seeking stops at streams.
 */
export const GET = withCcg({}, async ({ scope, query }) => {
  const portal = query.get('portal') === 'seeking' ? 'seeking' : 'ccg'
  const type = query.get('unit_type')
  const id = query.get('unit_id')
  if (!type || !id) return success(await drillChildren(scope, portal, null))
  if (!isUnitType(type)) throw invalid('unit_type must be campus, stream, council, ccg or ccf')
  const seeking = scope.sheepSeeking()
  const sees =
    portal === 'seeking'
      ? type === 'campus'
        ? seeking.canOnSeekingCampus('people.view', id) || seeking.canOnCampus('people.view', id)
        : type === 'stream' && seeking.canOnStream('people.view', id)
      : canSeeUnit(scope, type, id)
  ensure(sees, 'You can only open units in your scope')
  return success(await drillChildren(scope, portal, { type, id }))
})
