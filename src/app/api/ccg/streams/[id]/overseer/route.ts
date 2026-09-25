import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { addSeekerSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { setSeekingOverseer } from '@/lib/ccg/server/seekers'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/ccg/streams/[id]/overseer (roles.manage) — appoint the stream's
 * Sheep Seeking Overseer: `{ person_id }` or a new person's details (no CCF
 * needed). The current one, if different, stands down.
 */
export const PUT = withCcg<z.infer<typeof addSeekerSchema>, { id: string }>(
  { permission: 'roles.manage', schema: addSeekerSchema },
  async ({ request, user, scope, params, body }) => {
    ensure(scope.can('roles.manage'))
    return success(await setSeekingOverseer(params.id, body, user.id, new URL(request.url).origin))
  }
)
