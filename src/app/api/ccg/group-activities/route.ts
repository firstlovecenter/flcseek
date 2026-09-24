import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { forbidden } from '@/lib/ccg/errors'
import { groupActivitySchema } from '@/lib/ccg/schemas'
import type { IdSet } from '@/lib/ccg/scope'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { listGroupActivities, recordGroupActivity } from '@/lib/ccg/server/activities'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/group-activities?ccg_id=&type=&limit=
 * Logged CCG activities in scope (newest first), and a summary per CCG of
 * whether each activity has been held this week / quarter.
 */
export const GET = withCcg({}, async ({ scope, query }) => {
  if (!scope.anywhere.has('activities.record') && !scope.anywhere.has('reports.view')) throw forbidden()
  const a = scope.ccgIds('activities.record')
  const b = scope.ccgIds('reports.view')
  const ccgIds: IdSet = a === 'all' || b === 'all' ? 'all' : [...new Set([...a, ...b])]
  const limit = Number(query.get('limit') ?? '') || undefined
  return success(await listGroupActivities(ccgIds, { ccgId: query.get('ccg_id'), typeKey: query.get('type'), limit }))
})

/** POST /api/ccg/group-activities — log (or correct) one activity; same CCG, type and day updates it. */
export const POST = withCcg<z.infer<typeof groupActivitySchema>>(
  { permission: 'activities.record', schema: groupActivitySchema },
  async ({ user, scope, body }) => {
    ensure(scope.canOnCcg('activities.record', body.ccg_id))
    return created(await recordGroupActivity(body, user.id))
  }
)
