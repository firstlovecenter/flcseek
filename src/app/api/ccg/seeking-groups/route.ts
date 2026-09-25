import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { seekingGroupSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { createSeekingGroup, listSeekingGroups } from '@/lib/ccg/server/seeking-groups'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/seeking-groups?stream_id= — a stream's sheep seeking groups (a Sheep Seeker: their own). */
export const GET = withCcg({ permission: 'people.view' }, async ({ scope, query }) =>
  success({ groups: await listSeekingGroups(scope, query.get('stream_id')) })
)

/** POST /api/ccg/seeking-groups (seekers.manage on the stream: its Sheep Seeking Overseer) */
export const POST = withCcg<z.infer<typeof seekingGroupSchema>>({ permission: 'seekers.manage', schema: seekingGroupSchema }, async ({ user, scope, body }) => {
  const g = await createSeekingGroup(scope, body, user.id)
  return created({ id: g.id })
})
