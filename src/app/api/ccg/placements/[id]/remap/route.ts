import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { remapSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { authorisePlacement } from '@/lib/ccg/server/placement-routes'
import { remapPlacement } from '@/lib/ccg/server/placements'

export const dynamic = 'force-dynamic'

/** POST /api/ccg/placements/[id]/remap — place into a different CCF, with a reason. */
export const POST = withCcg<z.infer<typeof remapSchema>, { id: string }>(
  { permission: 'placements.approve', schema: remapSchema },
  async ({ user, scope, body, params }) => {
    await authorisePlacement(scope, 'placements.approve', params.id)
    ensure(scope.canOnCcf('placements.approve', body.ccf_id), 'You cannot place into that CCF')
    const p = await remapPlacement(params.id, body.ccf_id, body.reason, user.id)
    return success({ id: p.id, status: p.status, ccf_id: p.finalCcfId, full_ccf_override: p.fullCcfOverride })
  }
)
