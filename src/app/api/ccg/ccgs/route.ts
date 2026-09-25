import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { ccgSchema } from '@/lib/ccg/schemas'
import { inFilter } from '@/lib/ccg/scope'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { setUnitLeader } from '@/lib/ccg/server/roles'
import { assertCouncilExists, ccgInclude, createWithCode, serializeCcg } from '@/lib/ccg/server/units'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/ccgs?council_id= — CCGs the viewer can see, with CCF counts. */
export const GET = withCcg({}, async ({ scope, query }) => {
  const visible = scope.ccgIds('people.view')
  const councilId = query.get('council_id')
  const ccgs = await prisma.ccgGroup.findMany({
    where: {
      deletedAt: null,
      ...(inFilter(visible) ? { id: inFilter(visible) } : {}),
      ...(councilId ? { councilId } : {}),
    },
    include: { ...ccgInclude, _count: { select: { families: { where: { deletedAt: null } } } } },
    orderBy: { name: 'asc' },
  })
  return success({ ccgs: ccgs.map((g) => serializeCcg(g, { ccf_count: g._count.families })) })
})

/** POST /api/ccg/ccgs (structure.manage) */
export const POST = withCcg<z.infer<typeof ccgSchema>>(
  { permission: 'structure.manage', schema: ccgSchema },
  async ({ request, user, scope, body }) => {
    ensure(scope.can('structure.manage'))
    if (body.leader) ensure(scope.can('roles.manage'), 'Setting a leader needs permission to manage roles')
    await assertCouncilExists(body.council_id)
    const g = await createWithCode('ccg', body.code, (code) => prisma.ccgGroup.create({
      data: {
        councilId: body.council_id ?? null,
        code,
        name: body.name,
        status: body.status,
        notes: body.notes ?? null,
        createdBy: user.id,
      },
    }))
    await logCcg({ userId: user.id, action: 'CCG_CREATED', entityType: 'ccg_group', entityId: g.id, newValues: body })
    const leader_invite = body.leader ? await setUnitLeader('ccg', g.id, body.leader, user.id, new URL(request.url).origin) : null
    return created({ id: g.id, leader_invite })
  }
)
