import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { conflict, notFound } from '@/lib/ccg/errors'
import { streamUpdateSchema } from '@/lib/ccg/schemas'
import { iso, logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { setUnitLeader } from '@/lib/ccg/server/roles'
import { assertCampusExists, ccgInclude, serializeCcg } from '@/lib/ccg/server/units'
import { visibleStreamIds } from '@/lib/ccg/server/visibility'
import { inFilter } from '@/lib/ccg/scope'

export const dynamic = 'force-dynamic'
type P = { id: string }

async function load(id: string) {
  const s = await prisma.ccgStream.findFirst({ where: { id, deletedAt: null } })
  if (!s) throw notFound('Stream')
  return s
}

/** GET /api/ccg/streams/[id] — the stream and the CCGs in it the viewer leads (City Church Groups side). */
export const GET = withCcg<undefined, P>({}, async ({ scope, params }) => {
  const s = await load(params.id)
  const visible = await visibleStreamIds(scope)
  ensure(visible === 'all' || visible.includes(s.id), 'You can only view your streams')
  const ccgIds = inFilter(scope.leadership().ccgIds('people.view'))
  const ccgs = await prisma.ccgGroup.findMany({
    where: { streamId: s.id, deletedAt: null, ...(ccgIds ? { id: ccgIds } : {}) },
    include: ccgInclude,
    orderBy: { name: 'asc' },
  })
  return success({
    stream: { id: s.id, campus_id: s.campusId, code: s.code, name: s.name, status: s.status, notes: s.notes, created_at: iso(s.createdAt) },
    ccgs: ccgs.map((g) => serializeCcg(g)),
  })
})

/** PATCH /api/ccg/streams/[id] (structure.manage; a leader, the Overseer, needs roles.manage) */
export const PATCH = withCcg<z.infer<typeof streamUpdateSchema>, P>(
  { permission: 'structure.manage', schema: streamUpdateSchema },
  async ({ request, user, scope, body, params }) => {
    ensure(scope.can('structure.manage'))
    const before = await load(params.id)
    if (body.leader !== undefined) ensure(scope.can('roles.manage'), 'Setting a leader needs permission to manage roles')
    await assertCampusExists(body.campus_id)
    const { campus_id, leader, ...rest } = body
    await prisma.ccgStream.update({
      where: { id: params.id },
      data: { ...rest, ...(campus_id !== undefined ? { campusId: campus_id } : {}), updatedAt: new Date() },
    })
    const leader_invite = leader !== undefined ? await setUnitLeader('stream', params.id, leader, user.id, new URL(request.url).origin) : null
    await logCcg({ userId: user.id, action: 'STREAM_UPDATED', entityType: 'ccg_stream', entityId: params.id, oldValues: before, newValues: body })
    return success({ id: params.id, leader_invite })
  }
)

/** DELETE /api/ccg/streams/[id] — soft delete; its CCGs must be moved first. */
export const DELETE = withCcg<undefined, P>({ permission: 'structure.manage' }, async ({ user, scope, params }) => {
  ensure(scope.can('structure.manage'))
  await load(params.id)
  const [ccgs, councils] = await Promise.all([
    prisma.ccgGroup.count({ where: { streamId: params.id, deletedAt: null } }),
    prisma.ccgCouncil.count({ where: { streamId: params.id, deletedAt: null } }),
  ])
  if (ccgs || councils) throw conflict('Move this stream’s councils and CCGs to another stream first')
  await prisma.$transaction([
    prisma.ccgRoleAssignment.updateMany({ where: { streamId: params.id, endsOn: null }, data: { endsOn: new Date() } }),
    prisma.ccgStream.update({ where: { id: params.id }, data: { deletedAt: new Date(), status: 'inactive' } }),
  ])
  await logCcg({ userId: user.id, action: 'STREAM_DELETED', entityType: 'ccg_stream', entityId: params.id })
  return success({ id: params.id })
})
