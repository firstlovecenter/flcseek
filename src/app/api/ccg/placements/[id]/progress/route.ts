import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { progressSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { authorisePlacement } from '@/lib/ccg/server/placement-routes'
import { placementProgress, setProgress } from '@/lib/ccg/server/progress'

export const dynamic = 'force-dynamic'
type P = { id: string }

/** GET /api/ccg/placements/[id]/progress — milestones with derived status (done / due soon / overdue ...). */
export const GET = withCcg<undefined, P>({ permission: 'placements.view' }, async ({ scope, params }) => {
  await authorisePlacement(scope, 'placements.view', params.id)
  return success({ progress: await placementProgress(params.id) })
})

/** PUT /api/ccg/placements/[id]/progress — tick or untick one milestone. */
export const PUT = withCcg<z.infer<typeof progressSchema>, P>(
  { permission: 'milestones.update', schema: progressSchema },
  async ({ user, scope, body, params }) => {
    await authorisePlacement(scope, 'milestones.update', params.id)
    const { graduated } = await setProgress(params.id, body, user.id)
    return success({ graduated, progress: await placementProgress(params.id) })
  }
)
