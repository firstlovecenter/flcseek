import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { liaisonCcgsSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { setLiaisonCcgs } from '@/lib/ccg/server/seekers'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/ccg/streams/[id]/seekers/[assignmentId]/ccgs { ccg_ids } — make this Sheep Seeker
 * liaison for exactly these CCGs of the stream (roles.manage, or seekers.manage on the stream:
 * its Sheep Seeking Admin or the campus's). The converts placed in their CCFs become theirs
 * to follow. [] ends it.
 */
export const PUT = withCcg<z.infer<typeof liaisonCcgsSchema>, { id: string; assignmentId: string }>(
  { permission: 'seekers.manage', schema: liaisonCcgsSchema },
  async ({ user, scope, params, body }) => {
    ensure(
      scope.can('roles.manage') || scope.sheepSeeking().canOnStream('seekers.manage', params.id),
      'Only the stream’s Sheep Seeking Admin or the campus’s can assign liaisons'
    )
    return success(await setLiaisonCcgs(params.id, params.assignmentId, body.ccg_ids, user.id))
  }
)
