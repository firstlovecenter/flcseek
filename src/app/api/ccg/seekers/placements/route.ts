import { success } from '@/lib/api/response'
import { invalid } from '@/lib/ccg/errors'
import { withCcg } from '@/lib/ccg/server/handler'
import { placementBreakdown } from '@/lib/ccg/server/placement-breakdown'

export const dynamic = 'force-dynamic'

const day = (v: string | null, name: string) => {
  if (!v) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw invalid(`${name} must be a date (YYYY-MM-DD)`)
  return new Date(`${v}T00:00:00Z`)
}

/**
 * GET /api/ccg/seekers/placements?stream_id=&council_id=&ccg_id=&seeker=&from=&to= (reports.view
 * on the Sheep Seeking side) — the streams' converts per CCF, with its CCG and council: in the CCF
 * now, placed (in the period), awaiting approval, on hold, became members and dropped (in the
 * period), and those not placed yet. `to` is inclusive.
 */
export const GET = withCcg({ permission: 'reports.view' }, async ({ scope, query }) => {
  const to = day(query.get('to'), 'to')
  return success(
    await placementBreakdown(scope, {
      streamId: query.get('stream_id'),
      councilId: query.get('council_id'),
      ccgId: query.get('ccg_id'),
      seekerId: query.get('seeker'),
      from: day(query.get('from'), 'from'),
      to: to ? new Date(to.getTime() + 86_400_000) : null,
    })
  )
})
