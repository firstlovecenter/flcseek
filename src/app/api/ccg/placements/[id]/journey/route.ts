import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { authorisePlacement } from '@/lib/ccg/server/placement-routes'
import { placementJourney } from '@/lib/ccg/server/progress'

export const dynamic = 'force-dynamic'
type P = { id: string }

/** GET /api/ccg/placements/[id]/journey — attendance dates per event and the convert's history, for their modal. */
export const GET = withCcg<undefined, P>({ permission: 'placements.view' }, async ({ scope, params }) => {
  await authorisePlacement(scope, 'placements.view', params.id)
  return success({ journey: await placementJourney(params.id) })
})
