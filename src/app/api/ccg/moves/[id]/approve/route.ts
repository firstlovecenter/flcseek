import { success } from '@/lib/api/response'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { approveMove, deciderCcfId, loadMoveRequest } from '@/lib/ccg/server/moves'

export const dynamic = 'force-dynamic'

/** POST /api/ccg/moves/[id]/approve — the person moves to the CCF they registered into, keeping everything. */
export const POST = withCcg<undefined, { id: string }>({ permission: 'members.confirm' }, async ({ user, scope, params }) => {
  const r = await loadMoveRequest(params.id)
  ensure(scope.canOnCcf('members.confirm', deciderCcfId(r)), 'Only the coordinator of their current CCF can decide this')
  await approveMove(r.id, user.id)
  return success({ id: r.id, status: 'approved' })
})
