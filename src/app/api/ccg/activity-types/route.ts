import { success } from '@/lib/api/response'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { listActivityTypes } from '@/lib/ccg/server/activities'
import { holdsAny } from '@/lib/ccg/server/visibility'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/activity-types?include_inactive=1 — intercession, fellowship over food, with the manual's guidance. */
export const GET = withCcg({}, async ({ scope, query }) => {
  ensure(holdsAny(scope, 'activities.record', 'reports.view', 'settings.manage'))
  const includeInactive = query.get('include_inactive') === '1'
  if (includeInactive) ensure(scope.can('settings.manage'))
  return success({ activity_types: await listActivityTypes(includeInactive) })
})
