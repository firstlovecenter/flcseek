import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { closeCcfSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { closeCcf } from '@/lib/ccg/server/placements'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ccg/ccfs/[id]/close — close a CCF down, moving its members and
 * placed converts to `to_ccf_id` (needed unless it is empty). Converts keep
 * their milestones and assessment year; waiting proposals are matched again.
 * CONFLICT (details.reason = "convert_limit") when the receiving CCF can't
 * take the converts; then nothing moves.
 */
export const POST = withCcg<z.infer<typeof closeCcfSchema>, { id: string }>(
  { permission: 'structure.manage', schema: closeCcfSchema },
  async ({ user, scope, body, params }) => {
    ensure(scope.can('structure.manage'))
    const r = await closeCcf(params.id, body.to_ccf_id ?? null, user.id)
    return success({ id: params.id, to_ccf_id: r.to?.id ?? null, members_moved: r.members, converts_moved: r.converts, rematched: r.rematched })
  }
)
