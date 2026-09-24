import { success } from '@/lib/api/response'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { endAssignment } from '@/lib/ccg/server/roles'

export const dynamic = 'force-dynamic'

/** DELETE /api/ccg/assignments/[id] (roles.manage) — end the assignment today. */
export const DELETE = withCcg<undefined, { id: string }>({ permission: 'roles.manage' }, async ({ user, scope, params }) => {
  ensure(scope.can('roles.manage'))
  await endAssignment(params.id, user.id)
  return success({ id: params.id })
})
