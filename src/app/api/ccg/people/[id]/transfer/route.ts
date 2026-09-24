import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/ccg/errors'
import { transferSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { canOnPerson, personInclude } from '@/lib/ccg/server/people'
import { transferPerson } from '@/lib/ccg/server/placements'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ccg/people/[id]/transfer — move a member or placed convert to
 * another CCF. Needs people.manage on the person and on the new CCF. A placed
 * convert keeps their milestones and assessment year.
 */
export const POST = withCcg<z.infer<typeof transferSchema>, { id: string }>(
  { permission: 'people.manage', schema: transferSchema },
  async ({ user, scope, body, params }) => {
    const p = await prisma.ccgPerson.findFirst({ where: { id: params.id, deletedAt: null }, include: personInclude })
    if (!p) throw notFound('Person')
    ensure(canOnPerson(scope, 'people.manage', p), 'You can only transfer people in your scope')
    ensure(scope.canOnCcf('people.manage', body.ccf_id), 'You can only transfer people into CCFs in your scope')
    const t = await transferPerson(p.id, body.ccf_id, body.reason, user.id)
    return success({ id: t.id, over_capacity: t.overCapacity })
  }
)
