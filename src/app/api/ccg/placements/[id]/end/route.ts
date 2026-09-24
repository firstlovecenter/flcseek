import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { endSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { authorisePlacement } from '@/lib/ccg/server/placement-routes'
import { endPlacement } from '@/lib/ccg/server/placements'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ccg/placements/[id]/end — stop an active placement. With
 * reopen=true the convert is matched again straight away (e.g. they moved).
 */
export const POST = withCcg<z.infer<typeof endSchema>, { id: string }>(
  { permission: 'people.manage', schema: endSchema },
  async ({ user, scope, body, params }) => {
    await authorisePlacement(scope, 'people.manage', params.id)
    await endPlacement(params.id, body.reason, body.reopen, user.id)
    return success({ id: params.id, status: 'ended', reopened: body.reopen })
  }
)
