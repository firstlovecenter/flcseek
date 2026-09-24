import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { holdSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { authorisePlacement } from '@/lib/ccg/server/placement-routes'
import { holdPlacement } from '@/lib/ccg/server/placements'

export const dynamic = 'force-dynamic'

/** POST /api/ccg/placements/[id]/hold — park a proposal until more is known. */
export const POST = withCcg<z.infer<typeof holdSchema>, { id: string }>(
  { permission: 'placements.approve', schema: holdSchema },
  async ({ user, scope, body, params }) => {
    await authorisePlacement(scope, 'placements.approve', params.id)
    const p = await holdPlacement(params.id, body.reason, user.id)
    return success({ id: p.id, status: p.status })
  }
)
