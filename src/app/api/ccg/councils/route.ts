import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { councilSchema } from '@/lib/ccg/schemas'
import { inFilter } from '@/lib/ccg/scope'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { setUnitLeader } from '@/lib/ccg/server/roles'
import { assertStreamExists, createWithCode, serializeCouncil } from '@/lib/ccg/server/units'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/councils?stream_id= — councils the viewer leads (City Church Groups side), with CCG counts. */
export const GET = withCcg({}, async ({ scope, query }) => {
  const visible = inFilter(scope.leadership().councilIds('people.view'))
  const streamId = query.get('stream_id')
  const councils = await prisma.ccgCouncil.findMany({
    where: { deletedAt: null, ...(visible ? { id: visible } : {}), ...(streamId ? { streamId } : {}) },
    include: { stream: true, _count: { select: { ccgs: { where: { deletedAt: null } } } } },
    orderBy: { name: 'asc' },
  })
  return success({ councils: councils.map((c) => serializeCouncil(c, { ccg_count: c._count.ccgs })) })
})

/** POST /api/ccg/councils (structure.manage; its Council Admin, `leader`, needs roles.manage) */
export const POST = withCcg<z.infer<typeof councilSchema>>(
  { permission: 'structure.manage', schema: councilSchema },
  async ({ request, user, scope, body }) => {
    ensure(scope.can('structure.manage'))
    if (body.leader) ensure(scope.can('roles.manage'), 'Setting a Council Admin needs permission to manage roles')
    await assertStreamExists(body.stream_id)
    const { leader, ...rest } = body
    const c = await createWithCode('council', rest.code, (code) =>
      prisma.ccgCouncil.create({
        data: { streamId: rest.stream_id, code, name: rest.name, status: rest.status, notes: rest.notes ?? null, createdBy: user.id },
      })
    )
    await logCcg({ userId: user.id, action: 'COUNCIL_CREATED', entityType: 'ccg_council', entityId: c.id, newValues: body })
    const leader_invite = leader ? await setUnitLeader('council', c.id, leader, user.id, new URL(request.url).origin) : null
    return created({ id: c.id, leader_invite })
  }
)
