import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { ccgCreateSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { canBuildIn, canLeadBeneath } from '@/lib/ccg/server/admin-access'
import { setUnitLeader } from '@/lib/ccg/server/roles'
import { ccgInclude, ccgPlace, createWithCode, serializeCcg } from '@/lib/ccg/server/units'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/ccgs?stream_id=&council_id= — CCGs the viewer leads (City Church Groups side), and
 * those of streams they work in on the Sheep Seeking side (to place converts and choose liaisons), with CCF counts.
 */
export const GET = withCcg({}, async ({ scope, query }) => {
  const visible = scope.leadership().ccgIds('people.view')
  const seekingStreams = scope.sheepSeeking().streamIds('placements.view')
  const streamId = query.get('stream_id')
  const councilId = query.get('council_id')
  const visibility =
    visible === 'all' || seekingStreams === 'all'
      ? {}
      : { OR: [{ id: { in: visible } }, ...(seekingStreams.length ? [{ streamId: { in: seekingStreams } }] : [])] }
  const ccgs = await prisma.ccgGroup.findMany({
    where: {
      deletedAt: null,
      ...visibility,
      ...(streamId ? { streamId } : {}),
      ...(councilId ? { councilId } : {}),
    },
    include: { ...ccgInclude, _count: { select: { families: { where: { deletedAt: null } } } } },
    orderBy: { name: 'asc' },
  })
  return success({ ccgs: ccgs.map((g) => serializeCcg(g, { ccf_count: g._count.families })) })
})

/**
 * POST /api/ccg/ccgs — into a council (and its stream), or a stream with no council yet: by the
 * central team, or the admins of that council or above it. Its Overseer needs leaders.appoint there.
 */
export const POST = withCcg<z.infer<typeof ccgCreateSchema>>(
  { permission: 'units.edit', schema: ccgCreateSchema },
  async ({ request, user, scope, body }) => {
    const place = await ccgPlace(body)
    const [level, parentId] = place.councilId ? (['council', place.councilId] as const) : (['stream', place.streamId] as const)
    ensure(canBuildIn(scope, level, parentId), `Only the central team, or the ${level}’s admins, add CCGs here`)
    if (body.leader) ensure(canLeadBeneath(scope, level, parentId), 'You cannot choose this CCG’s Overseer')
    const g = await createWithCode('ccg', body.code, (code) => prisma.ccgGroup.create({
      data: {
        streamId: place.streamId!,
        councilId: place.councilId,
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
