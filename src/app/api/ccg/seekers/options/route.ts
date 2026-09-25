import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { seekersIn } from '@/lib/ccg/server/seekers'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/seekers/options?stream_id= — Sheep Seekers to choose from (a convert's or intake link's seeker). */
export const GET = withCcg({ permission: 'people.view' }, async ({ query }) => {
  const streamId = query.get('stream_id')
  return success({ seekers: await seekersIn(streamId ? [streamId] : 'all') })
})
