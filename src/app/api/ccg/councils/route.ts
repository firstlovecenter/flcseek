import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { councilSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { setUnitLeader } from '@/lib/ccg/server/roles'
import { assertStreamExists, serializeCouncil } from '@/lib/ccg/server/units'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/councils?stream_id= */
export const GET = withCcg({}, async ({ query }) => {
  const streamId = query.get('stream_id')
  const councils = await prisma.ccgCouncil.findMany({
    where: { deletedAt: null, ...(streamId ? { streamId } : {}) },
    include: { _count: { select: { groups: { where: { deletedAt: null } } } } },
    orderBy: { code: 'asc' },
  })
  return success({ councils: councils.map((c) => serializeCouncil(c, { ccg_count: c._count.groups })) })
})

/** POST /api/ccg/councils (structure.manage) */
export const POST = withCcg<z.infer<typeof councilSchema>>(
  { permission: 'structure.manage', schema: councilSchema },
  async ({ request, user, scope, body }) => {
    ensure(scope.can('structure.manage'))
    if (body.leader) ensure(scope.can('roles.manage'), 'Setting a leader needs permission to manage roles')
    await assertStreamExists(body.stream_id)
    const c = await prisma.ccgCouncil.create({
      data: { streamId: body.stream_id ?? null, code: body.code, name: body.name, status: body.status, notes: body.notes ?? null, createdBy: user.id },
    })
    await logCcg({ userId: user.id, action: 'COUNCIL_CREATED', entityType: 'ccg_council', entityId: c.id, newValues: body })
    const leader_invite = body.leader ? await setUnitLeader('council', c.id, body.leader, user.id, new URL(request.url).origin) : null
    return created({ id: c.id, leader_invite })
  }
)
