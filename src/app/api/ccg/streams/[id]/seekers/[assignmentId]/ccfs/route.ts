import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { liaisonCcfsSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { setLiaisonCcfs } from '@/lib/ccg/server/seekers'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/ccg/streams/[id]/seekers/[assignmentId]/ccfs { ccf_ids } — make this Sheep Seeker
 * liaison for exactly these CCFs of the stream (roles.manage, or seekers.manage on the stream:
 * its Sheep Seeking Admin). The converts placed there become theirs to follow. [] ends it.
 */
export const PUT = withCcg<z.infer<typeof liaisonCcfsSchema>, { id: string; assignmentId: string }>(
  { permission: 'seekers.manage', schema: liaisonCcfsSchema },
  async ({ user, scope, params, body }) => {
    ensure(scope.can('roles.manage') || scope.canOnStream('seekers.manage', params.id), 'Only the stream’s Sheep Seeking Admin or an admin can assign liaisons')
    return success(await setLiaisonCcfs(params.id, params.assignmentId, body.ccf_ids, user.id))
  }
)
