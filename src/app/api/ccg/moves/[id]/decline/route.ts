import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { moveDeclineSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { declineMove, deciderCcfId, loadMoveRequest } from '@/lib/ccg/server/moves'

export const dynamic = 'force-dynamic'

/** POST /api/ccg/moves/[id]/decline — they stay in their current CCF. Body `{ reason? }`. */
export const POST = withCcg<z.infer<typeof moveDeclineSchema>, { id: string }>(
  { permission: 'members.confirm', schema: moveDeclineSchema },
  async ({ user, scope, body, params }) => {
    const r = await loadMoveRequest(params.id)
    ensure(scope.canOnCcf('members.confirm', deciderCcfId(r)), 'Only the coordinator of their current CCF can decide this')
    await declineMove(r.id, body.reason?.trim() || null, user.id)
    return success({ id: r.id, status: 'declined' })
  }
)
