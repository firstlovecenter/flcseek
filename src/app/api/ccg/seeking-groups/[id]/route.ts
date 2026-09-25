import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { seekingGroupUpdateSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { removeSeekingGroup, seekingGroupDetail, updateSeekingGroup } from '@/lib/ccg/server/seeking-groups'

export const dynamic = 'force-dynamic'
type P = { id: string }

/** GET /api/ccg/seeking-groups/[id] — the group, its Sheep Seekers and its converts. */
export const GET = withCcg<undefined, P>({ permission: 'people.view' }, async ({ scope, params }) => success(await seekingGroupDetail(scope, params.id)))

/** PATCH /api/ccg/seeking-groups/[id] — rename, notes, status (the stream's Overseer). */
export const PATCH = withCcg<z.infer<typeof seekingGroupUpdateSchema>, P>(
  { permission: 'seekers.manage', schema: seekingGroupUpdateSchema },
  async ({ user, scope, params, body }) => {
    await updateSeekingGroup(scope, params.id, body, user.id)
    return success({ id: params.id })
  }
)

/** DELETE /api/ccg/seeking-groups/[id] — close an empty group. */
export const DELETE = withCcg<undefined, P>({ permission: 'seekers.manage' }, async ({ user, scope, params }) => {
  await removeSeekingGroup(scope, params.id, user.id)
  return success({ id: params.id })
})
