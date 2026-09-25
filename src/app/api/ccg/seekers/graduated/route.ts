import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { graduatedList } from '@/lib/ccg/server/seekers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/seekers/graduated?stream_id=&seeker=me&search=&limit=&offset= — converts who
 * completed their assessment and became CCF members (read-only, for statistics).
 */
export const GET = withCcg({ permission: 'reports.view' }, async ({ scope, query }) =>
  success(
    await graduatedList(scope, {
      streamId: query.get('stream_id'),
      mine: query.get('seeker') === 'me',
      search: query.get('search')?.trim() || null,
      limit: Math.min(Number(query.get('limit')) || 50, 200),
      offset: Math.max(Number(query.get('offset')) || 0, 0),
    })
  )
)
