import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { conflict, notFound } from '@/lib/ccg/errors'
import { councilUpdateSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { setUnitLeader } from '@/lib/ccg/server/roles'
import { assertStreamExists, ccgInclude, serializeCcg, serializeCouncil } from '@/lib/ccg/server/units'

export const dynamic = 'force-dynamic'
type P = { id: string }

async function load(id: string) {
  const c = await prisma.ccgCouncil.findFirst({ where: { id, deletedAt: null } })
  if (!c) throw notFound('Council')
  return c
}

/** GET /api/ccg/councils/[id] — the council and its CCGs. */
export const GET = withCcg<undefined, P>({}, async ({ params }) => {
  const c = await load(params.id)
  const ccgs = await prisma.ccgGroup.findMany({ where: { councilId: c.id, deletedAt: null }, include: ccgInclude, orderBy: { name: 'asc' } })
  return success({ council: serializeCouncil(c), ccgs: ccgs.map((g) => serializeCcg(g)) })
})

/** PATCH /api/ccg/councils/[id] (structure.manage) */
export const PATCH = withCcg<z.infer<typeof councilUpdateSchema>, P>(
  { permission: 'structure.manage', schema: councilUpdateSchema },
  async ({ request, user, scope, body, params }) => {
    ensure(scope.can('structure.manage'))
    const before = await load(params.id)
    if (body.leader !== undefined) ensure(scope.can('roles.manage'), 'Setting a leader needs permission to manage roles')
    await assertStreamExists(body.stream_id)
    const { stream_id, leader, ...rest } = body
    await prisma.ccgCouncil.update({
      where: { id: params.id },
      data: { ...rest, ...(stream_id !== undefined ? { streamId: stream_id } : {}), updatedAt: new Date() },
    })
    const leader_invite = leader !== undefined ? await setUnitLeader('council', params.id, leader, user.id, new URL(request.url).origin) : null
    await logCcg({ userId: user.id, action: 'COUNCIL_UPDATED', entityType: 'ccg_council', entityId: params.id, oldValues: before, newValues: body })
    return success({ id: params.id, leader_invite })
  }
)

/** DELETE /api/ccg/councils/[id] — soft delete; its CCGs must be moved first. */
export const DELETE = withCcg<undefined, P>({ permission: 'structure.manage' }, async ({ user, scope, params }) => {
  ensure(scope.can('structure.manage'))
  await load(params.id)
  if (await prisma.ccgGroup.count({ where: { councilId: params.id, deletedAt: null } })) {
    throw conflict('Move this council’s CCGs to another council first')
  }
  await prisma.$transaction([
    prisma.ccgRoleAssignment.updateMany({ where: { councilId: params.id, endsOn: null }, data: { endsOn: new Date() } }),
    prisma.ccgCouncil.update({ where: { id: params.id }, data: { deletedAt: new Date(), status: 'inactive' } }),
  ])
  await logCcg({ userId: user.id, action: 'COUNCIL_DELETED', entityType: 'ccg_council', entityId: params.id })
  return success({ id: params.id })
})
