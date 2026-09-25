import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { removeGroupConvert } from '@/lib/ccg/server/seeking-groups'

export const dynamic = 'force-dynamic'

/** DELETE /api/ccg/seeking-groups/[id]/converts/[personId] — take a convert out of the group. */
export const DELETE = withCcg<undefined, { id: string; personId: string }>({ permission: 'seekers.manage' }, async ({ user, scope, params }) => {
  await removeGroupConvert(scope, params.id, params.personId, user.id)
  return success({ ok: true })
})
