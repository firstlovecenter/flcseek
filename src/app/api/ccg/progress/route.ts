import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { listProgress } from '@/lib/ccg/server/progress'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/progress?ccf_id=&ccg_id=&council_id=&stream_id=&seeker=me&overdue=1 — the milestone grid:
 * every active placement in scope x active milestones, with derived status.
 * seeker=me: only the converts in the signed-in Sheep Seeker's groups.
 */
export const GET = withCcg({ permission: 'placements.view' }, async ({ scope, query }) =>
  success(
    await listProgress(scope, {
      ccfId: query.get('ccf_id'),
      ccgId: query.get('ccg_id'),
      councilId: query.get('council_id'),
      streamId: query.get('stream_id'),
      overdueOnly: query.get('overdue') === '1',
      seekingGroupIds: query.get('seeker') === 'me' ? scope.seekingGroupIds : null,
    })
  )
)
