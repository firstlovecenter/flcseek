import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { approveSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { authorisePlacement } from '@/lib/ccg/server/placement-routes'
import { approvePlacement } from '@/lib/ccg/server/placements'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ccg/placements/[id]/approve — accept the proposed CCF. Re-checks
 * the CCF under a lock; if it filled up meanwhile the call fails with
 * CONFLICT (details.reason = "ccf_full") — rescore to get a new proposal.
 */
export const POST = withCcg<z.infer<typeof approveSchema>, { id: string }>(
  { permission: 'placements.approve', schema: approveSchema },
  async ({ user, scope, body, params }) => {
    await authorisePlacement(scope, 'placements.approve', params.id)
    const p = await approvePlacement(params.id, user.id, body.override_reason)
    return success({ id: p.id, status: p.status, ccf_id: p.finalCcfId, full_ccf_override: p.fullCcfOverride })
  }
)
