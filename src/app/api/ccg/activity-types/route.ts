import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { listActivityTypes } from '@/lib/ccg/server/activities'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/activity-types?include_inactive=1 — intercession, fellowship over food, with the manual's guidance. */
export const GET = withCcg({}, async ({ query }) => {
  return success({ activity_types: await listActivityTypes(query.get('include_inactive') === '1') })
})
