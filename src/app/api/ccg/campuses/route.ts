import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { campusSchema } from '@/lib/ccg/schemas'
import { iso, logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { setUnitLeader } from '@/lib/ccg/server/roles'
import { createWithCode } from '@/lib/ccg/server/units'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/campuses — with stream counts. */
export const GET = withCcg({}, async () => {
  const campuses = await prisma.ccgCampus.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { streams: { where: { deletedAt: null } } } } },
    orderBy: { name: 'asc' },
  })
  return success({
    campuses: campuses.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      status: c.status,
      notes: c.notes,
      stream_count: c._count.streams,
      created_at: iso(c.createdAt),
    })),
  })
})

/** POST /api/ccg/campuses (structure.manage; a leader needs roles.manage) */
export const POST = withCcg<z.infer<typeof campusSchema>>(
  { permission: 'structure.manage', schema: campusSchema },
  async ({ request, user, scope, body }) => {
    ensure(scope.can('structure.manage'))
    if (body.leader) ensure(scope.can('roles.manage'), 'Setting a leader needs permission to manage roles')
    const c = await createWithCode('campus', body.code, (code) =>
      prisma.ccgCampus.create({ data: { code, name: body.name, status: body.status, notes: body.notes ?? null, createdBy: user.id } })
    )
    await logCcg({ userId: user.id, action: 'CAMPUS_CREATED', entityType: 'ccg_campus', entityId: c.id, newValues: body })
    const leader_invite = body.leader ? await setUnitLeader('campus', c.id, body.leader, user.id, new URL(request.url).origin) : null
    return created({ id: c.id, leader_invite })
  }
)
