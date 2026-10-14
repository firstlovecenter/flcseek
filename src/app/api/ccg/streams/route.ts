import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { streamSchema } from '@/lib/ccg/schemas'
import { iso, logCcg } from '@/lib/ccg/server/common'
import { canBuildIn, canLeadBeneath } from '@/lib/ccg/server/admin-access'
import { setUnitLeader } from '@/lib/ccg/server/roles'
import { assertCampusExists, createWithCode } from '@/lib/ccg/server/units'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { visibleStreamIds } from '@/lib/ccg/server/visibility'
import { inFilter } from '@/lib/ccg/scope'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/streams — the streams the viewer works in (all, church-wide), with CCG counts. */
export const GET = withCcg({}, async ({ scope }) => {
  const visible = inFilter(await visibleStreamIds(scope))
  const streams = await prisma.ccgStream.findMany({
    where: { deletedAt: null, ...(visible ? { id: visible } : {}) },
    include: { _count: { select: { ccgs: { where: { deletedAt: null } } } } },
    orderBy: { name: 'asc' },
  })
  return success({
    streams: streams.map((s) => ({
      id: s.id,
      campus_id: s.campusId,
      code: s.code,
      name: s.name,
      status: s.status,
      notes: s.notes,
      ccg_count: s._count.ccgs,
      created_at: iso(s.createdAt),
    })),
  })
})

/** POST /api/ccg/streams (the central team, or a Campus Admin into their campus; its Stream Leader needs leaders.appoint there) */
export const POST = withCcg<z.infer<typeof streamSchema>>(
  { permission: 'units.edit', schema: streamSchema },
  async ({ request, user, scope, body }) => {
    ensure(canBuildIn(scope, 'campus', body.campus_id), 'Only the central team, or the campus’s admins, add streams')
    if (body.leader) ensure(canLeadBeneath(scope, 'campus', body.campus_id), 'You cannot choose this stream’s leader')
    await assertCampusExists(body.campus_id)
    const { leader, ...rest } = body
    const s = await createWithCode('stream', rest.code, (code) =>
      prisma.ccgStream.create({ data: { code, campusId: rest.campus_id ?? null, name: rest.name, status: rest.status, notes: rest.notes ?? null, createdBy: user.id } })
    )
    await logCcg({ userId: user.id, action: 'STREAM_CREATED', entityType: 'ccg_stream', entityId: s.id, newValues: body })
    const leader_invite = leader ? await setUnitLeader('stream', s.id, leader, user.id, new URL(request.url).origin) : null
    return created({ id: s.id, leader_invite })
  }
)
