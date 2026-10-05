import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { listMoveRequests } from '@/lib/ccg/server/moves'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/moves?status=pending|approved|declined — move requests for CCFs
 * in the viewer's scope (coming in or going out). `can_decide` marks those
 * waiting on this viewer: the coordinator of the person's current CCF decides.
 */
export const GET = withCcg({ permission: 'members.confirm' }, async ({ scope, query }) => {
  const status = ['approved', 'declined', 'cancelled'].includes(query.get('status') ?? '') ? query.get('status')! : 'pending'
  const ccfIds = scope.ccfIds('members.confirm')
  const rows = await listMoveRequests({ ccfIds: ccfIds === 'all' ? 'all' : [...ccfIds], status })
  return success({ requests: rows.map((r) => ({ ...r, can_decide: r.status === 'pending' && scope.canOnCcf('members.confirm', r.decider_ccf_id) })) })
})
