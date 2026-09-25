import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { removeGroupSeeker } from '@/lib/ccg/server/seeking-groups'

export const dynamic = 'force-dynamic'

/** DELETE /api/ccg/seeking-groups/[id]/seekers/[userId] — take a Sheep Seeker off the group. */
export const DELETE = withCcg<undefined, { id: string; userId: string }>({ permission: 'seekers.manage' }, async ({ user, scope, params }) => {
  await removeGroupSeeker(scope, params.id, params.userId, user.id)
  return success({ ok: true })
})
