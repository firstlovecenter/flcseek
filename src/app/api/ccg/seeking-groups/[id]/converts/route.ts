import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { groupConvertsSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { addGroupConverts } from '@/lib/ccg/server/seeking-groups'

export const dynamic = 'force-dynamic'

/** POST /api/ccg/seeking-groups/[id]/converts { person_ids } — put converts of the stream in the group. */
export const POST = withCcg<z.infer<typeof groupConvertsSchema>, { id: string }>(
  { permission: 'seekers.manage', schema: groupConvertsSchema },
  async ({ user, scope, params, body }) => {
    await addGroupConverts(scope, params.id, body.person_ids, user.id)
    return success({ ok: true })
  }
)
