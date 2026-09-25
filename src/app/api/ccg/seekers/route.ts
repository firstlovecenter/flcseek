import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { seekerReport } from '@/lib/ccg/server/seekers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/seekers?stream_id=&period=week|month&offset=0 (reports.view on the streams)
 * Per Sheep Seeker, for one week or month (offset back from the current one):
 * converts registered, placed, became members and dropped, and those in their
 * assessment year now.
 */
export const GET = withCcg({ permission: 'reports.view' }, async ({ scope, query }) =>
  success(
    await seekerReport(scope, {
      streamId: query.get('stream_id'),
      period: query.get('period') === 'month' ? 'month' : 'week',
      offset: Math.min(Math.max(Number(query.get('offset')) || 0, 0), 260),
    })
  )
)
