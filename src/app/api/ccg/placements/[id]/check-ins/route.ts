import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { checkInSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { authorisePlacement } from '@/lib/ccg/server/placement-routes'
import { listCheckIns, recordCheckIn } from '@/lib/ccg/server/progress'

export const dynamic = 'force-dynamic'
type P = { id: string }

/** GET /api/ccg/placements/[id]/check-ins — newest first. */
export const GET = withCcg<undefined, P>({ permission: 'placements.view' }, async ({ scope, params }) => {
  await authorisePlacement(scope, 'placements.view', params.id)
  return success({ check_ins: await listCheckIns(params.id) })
})

/** POST /api/ccg/placements/[id]/check-ins — ratings, notes, follow-up flag. */
export const POST = withCcg<z.infer<typeof checkInSchema>, P>(
  { permission: 'checkins.record', schema: checkInSchema },
  async ({ user, scope, body, params }) => {
    await authorisePlacement(scope, 'checkins.record', params.id)
    const c = await recordCheckIn(params.id, body, user.id)
    return created({ id: c.id })
  }
)
