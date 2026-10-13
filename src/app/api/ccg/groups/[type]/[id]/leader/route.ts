import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { invalid } from '@/lib/ccg/errors'
import { setLeaderSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { canSetLeader } from '@/lib/ccg/server/admin-access'
import { setUnitLeader } from '@/lib/ccg/server/roles'
import { isUnitType } from '@/lib/ccg/server/unit-overview'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/ccg/groups/[type]/[id]/leader — change a unit's leader, from its page
 * (leaders.appoint on the unit above it, or roles.manage): `{ leader: { person_id } }`,
 * a new person's details (not for a CCF), or `{ leader: null }`. The old leader
 * stands down; the new one is emailed.
 */
export const PUT = withCcg<z.infer<typeof setLeaderSchema>, { type: string; id: string }>(
  { schema: setLeaderSchema },
  async ({ request, user, scope, params, body }) => {
    const type = params.type
    if (!isUnitType(type)) throw invalid('Unknown unit type')
    ensure(await canSetLeader(scope, type, params.id), 'Only the leaders and admins above this unit, or the central team, change its leader')
    if (type === 'ccf' && body.leader) {
      const member =
        'person_id' in body.leader &&
        (await prisma.ccgPerson.findFirst({
          where: { id: body.leader.person_id, ccfId: params.id, kind: 'member', status: 'active', deletedAt: null },
          select: { id: true },
        }))
      if (!member) throw invalid('A CCF’s Coordinator is one of its active members')
    }
    const invite = await setUnitLeader(type, params.id, body.leader, user.id, new URL(request.url).origin)
    return success({ invite })
  }
)
