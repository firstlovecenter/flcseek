import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { bulkApproveSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { bulkApprove } from '@/lib/ccg/server/placements'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ccg/placements/bulk-approve — approve many proposals. Each is
 * decided on its own; the response reports success or the reason per id.
 */
export const POST = withCcg<z.infer<typeof bulkApproveSchema>>(
  { permission: 'placements.approve', schema: bulkApproveSchema },
  async ({ user, scope, body }) => {
    const results = await bulkApprove(body.placement_ids, user.id, (ccfId) =>
      ccfId ? scope.canOnCcf('placements.approve', ccfId) : scope.can('placements.approve')
    )
    return success({
      approved: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    })
  }
)
