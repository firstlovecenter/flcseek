import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { authorisePlacement } from '@/lib/ccg/server/placement-routes'
import { markIntegrated } from '@/lib/ccg/server/placements'

export const dynamic = 'force-dynamic'

/** POST /api/ccg/placements/[id]/integrate — mark the convert integrated (still followed up). */
export const POST = withCcg<undefined, { id: string }>({ permission: 'milestones.update' }, async ({ user, scope, params }) => {
  await authorisePlacement(scope, 'milestones.update', params.id)
  await markIntegrated(params.id, user.id)
  return success({ id: params.id, person_status: 'integrated' })
})
