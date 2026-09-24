import { success } from '@/lib/api/response'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { deleteGroupActivity, getGroupActivity } from '@/lib/ccg/server/activities'

export const dynamic = 'force-dynamic'

/** DELETE /api/ccg/group-activities/[id] — remove a mistaken entry. */
export const DELETE = withCcg<undefined, { id: string }>({ permission: 'activities.record' }, async ({ user, scope, params }) => {
  const a = await getGroupActivity(params.id)
  ensure(scope.canOnCcg('activities.record', a.ccgId))
  await deleteGroupActivity(params.id, user.id)
  return success({ id: params.id })
})
