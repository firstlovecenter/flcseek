import type { z } from 'zod'
import { created } from '@/lib/api/response'
import { groupSeekerSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { addGroupSeeker } from '@/lib/ccg/server/seeking-groups'

export const dynamic = 'force-dynamic'

/** POST /api/ccg/seeking-groups/[id]/seekers { user_id } — assign a Sheep Seeker of the stream to the group. */
export const POST = withCcg<z.infer<typeof groupSeekerSchema>, { id: string }>(
  { permission: 'seekers.manage', schema: groupSeekerSchema },
  async ({ user, scope, params, body }) => {
    await addGroupSeeker(scope, params.id, body.user_id, user.id)
    return created({ ok: true })
  }
)
