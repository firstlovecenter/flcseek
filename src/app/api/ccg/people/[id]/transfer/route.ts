import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/ccg/errors'
import { transferSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { canEditPerson, personInclude } from '@/lib/ccg/server/people'
import { transferPerson } from '@/lib/ccg/server/placements'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ccg/people/[id]/transfer — move a member or placed convert to
 * another CCF. A member needs members.edit on both CCFs; a convert people.manage. A placed
 * convert keeps their milestones and assessment year.
 */
export const POST = withCcg<z.infer<typeof transferSchema>, { id: string }>(
  { schema: transferSchema },
  async ({ user, scope, body, params }) => {
    const p = await prisma.ccgPerson.findFirst({ where: { id: params.id, deletedAt: null }, include: personInclude })
    if (!p) throw notFound('Person')
    ensure(canEditPerson(scope, p), 'You can only transfer people in your scope')
    ensure(
      p.kind === 'member' ? scope.canOnMembersOf('members.edit', body.ccf_id) : scope.canPlaceInto('people.manage', body.ccf_id),
      'You can only transfer people into CCFs in your scope'
    )
    const t = await transferPerson(p.id, body.ccf_id, body.reason, user.id)
    return success({ id: t.id, over_capacity: t.overCapacity })
  }
)
