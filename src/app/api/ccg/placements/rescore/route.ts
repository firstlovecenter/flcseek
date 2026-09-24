import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { rescoreSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { rescore } from '@/lib/ccg/server/placements'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ccg/placements/rescore — re-match every waiting convert (or the
 * given ones), e.g. after a CCF opens, capacity changes or settings change.
 * Stream-level approvers rescore the converts registered in their streams.
 */
export const POST = withCcg<z.infer<typeof rescoreSchema>>(
  { permission: 'placements.approve', schema: rescoreSchema },
  async ({ user, scope, body }) => {
    const streams = scope.streamIds('placements.approve')
    ensure(streams === 'all' || streams.length > 0, 'Only the central team or a stream Sheep Seeker can rescore')
    return success(await rescore(user.id, body.person_ids, streams === 'all' ? undefined : streams))
  }
)
