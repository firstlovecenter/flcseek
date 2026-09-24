import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { authorisePlacement } from '@/lib/ccg/server/placement-routes'
import { makeMember } from '@/lib/ccg/server/placements'

export const dynamic = 'force-dynamic'

/** POST /api/ccg/placements/[id]/make-member — the convert joins the CCF as a member. */
export const POST = withCcg<undefined, { id: string }>({ permission: 'people.manage' }, async ({ user, scope, params }) => {
  const p = await authorisePlacement(scope, 'people.manage', params.id)
  await makeMember(params.id, user.id)
  return success({ id: params.id, person_id: p.personId, kind: 'member' })
})
