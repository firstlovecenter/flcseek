import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { conflict, notFound } from '@/lib/ccg/errors'
import { ccgUpdateSchema } from '@/lib/ccg/schemas'
import { ccgTx, getCcgConfig, logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { canBuildIn, canSetLeader } from '@/lib/ccg/server/admin-access'
import { setUnitLeader } from '@/lib/ccg/server/roles'
import { loadProfiles } from '@/lib/ccg/server/profiles'
import { loadQuestionBank } from '@/lib/ccg/server/questions'
import {
  carryCcgsIntoStream,
  ccgPlace,
  ccfInclude,
  ccgInclude,
  serializeAggregate,
  serializeCcf,
  serializeCcg,
  serializeProfile,
} from '@/lib/ccg/server/units'

export const dynamic = 'force-dynamic'
type P = { id: string }

async function load(id: string) {
  const g = await prisma.ccgGroup.findFirst({ where: { id, deletedAt: null }, include: ccgInclude })
  if (!g) throw notFound('CCG')
  return g
}

/** GET /api/ccg/ccgs/[id] — the CCG, its combined profile, and each CCF with its profile. */
export const GET = withCcg<undefined, P>({}, async ({ scope, params }) => {
  const g = await load(params.id)
  ensure(scope.leadership().canOnCcg('people.view', g.id), 'You can only view CCGs in your scope')
  const [bank, config, ccfs] = await Promise.all([
    loadQuestionBank(),
    getCcgConfig(),
    prisma.ccgFamily.findMany({ where: { ccgId: g.id, deletedAt: null }, include: ccfInclude, orderBy: { name: 'asc' } }),
  ])
  const { byCcf, ccgAggregates } = await loadProfiles({ bank, config, ccfIds: ccfs.map((f) => f.id) })
  const agg = ccgAggregates.get(g.id)
  return success({
    ccg: serializeCcg(g),
    profile: agg ? serializeAggregate(agg, bank) : null,
    ccfs: ccfs.map((f) => {
      const p = byCcf.get(f.id)
      return serializeCcf(f, p ? { profile: serializeProfile(p, bank) } : {})
    }),
  })
})

/**
 * PATCH /api/ccg/ccgs/[id] (the central team, or the admins of the CCG and above it; moving it needs
 * units.edit where it is and where it goes; its Overseer as on PUT …/leader)
 */
export const PATCH = withCcg<z.infer<typeof ccgUpdateSchema>, P>(
  { permission: 'units.edit', schema: ccgUpdateSchema },
  async ({ request, user, scope, body, params }) => {
    const before = await load(params.id)
    ensure(canBuildIn(scope, 'ccg', params.id), 'Only the central team, or this CCG’s admins, edit it')
    if (body.leader !== undefined) ensure(await canSetLeader(scope, 'ccg', params.id), 'Only the leaders and admins above this CCG, or the central team, change its Overseer')
    // Moving it: into a council (taking the council's stream), or out of its council within a stream.
    const place = body.council_id
      ? await ccgPlace({ council_id: body.council_id })
      : body.council_id === null
        ? await ccgPlace({ stream_id: body.stream_id ?? before.streamId })
        : body.stream_id && body.stream_id !== before.streamId
          ? await ccgPlace({ stream_id: body.stream_id })
          : null
    if (place && (place.councilId !== before.councilId || place.streamId !== before.streamId)) {
      const from = before.councilId ? canBuildIn(scope, 'council', before.councilId) : canBuildIn(scope, 'stream', before.streamId)
      const to = place.councilId ? canBuildIn(scope, 'council', place.councilId) : canBuildIn(scope, 'stream', place.streamId)
      ensure(from && to, 'You can only move a CCG between councils and streams you run')
    }
    // Moved with everything in it: its CCFs, and the converts placed there follow it into its stream.
    await ccgTx(async (tx) => {
      await tx.ccgGroup.update({
        where: { id: params.id },
        data: {
          ...(place ? { councilId: place.councilId } : {}),
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          updatedAt: new Date(),
        },
      })
      if (place?.streamId) await carryCcgsIntoStream(tx, { id: params.id }, place.streamId)
    })
    const leader_invite =
      body.leader !== undefined ? await setUnitLeader('ccg', params.id, body.leader, user.id, new URL(request.url).origin) : null
    await logCcg({ userId: user.id, action: 'CCG_UPDATED', entityType: 'ccg_group', entityId: params.id, oldValues: before, newValues: body })
    return success({ id: params.id, leader_invite })
  }
)

/** DELETE /api/ccg/ccgs/[id] — soft delete; its CCFs must be removed first. */
export const DELETE = withCcg<undefined, P>({ permission: 'structure.manage' }, async ({ user, scope, params }) => {
  ensure(scope.can('structure.manage'))
  await load(params.id)
  if (await prisma.ccgFamily.count({ where: { ccgId: params.id, deletedAt: null } })) {
    throw conflict('Remove or move this CCG’s CCFs first')
  }
  await prisma.$transaction([
    prisma.ccgRoleAssignment.updateMany({ where: { ccgId: params.id, endsOn: null }, data: { endsOn: new Date() } }),
    prisma.ccgGroup.update({ where: { id: params.id }, data: { deletedAt: new Date(), status: 'inactive' } }),
  ])
  await logCcg({ userId: user.id, action: 'CCG_DELETED', entityType: 'ccg_group', entityId: params.id })
  return success({ id: params.id })
})
