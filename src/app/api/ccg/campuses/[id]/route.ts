import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { conflict, notFound } from '@/lib/ccg/errors'
import { campusUpdateSchema } from '@/lib/ccg/schemas'
import { iso, logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { setUnitLeader } from '@/lib/ccg/server/roles'

export const dynamic = 'force-dynamic'
type P = { id: string }

async function load(id: string) {
  const c = await prisma.ccgCampus.findFirst({ where: { id, deletedAt: null } })
  if (!c) throw notFound('Campus')
  return c
}

/** GET /api/ccg/campuses/[id] — the campus and its streams. */
export const GET = withCcg<undefined, P>({}, async ({ params }) => {
  const c = await load(params.id)
  const streams = await prisma.ccgStream.findMany({ where: { campusId: c.id, deletedAt: null }, orderBy: { name: 'asc' } })
  return success({
    campus: { id: c.id, code: c.code, name: c.name, status: c.status, notes: c.notes, created_at: iso(c.createdAt) },
    streams: streams.map((s) => ({ id: s.id, code: s.code, name: s.name, status: s.status })),
  })
})

/** PATCH /api/ccg/campuses/[id] (structure.manage; the leader needs roles.manage) */
export const PATCH = withCcg<z.infer<typeof campusUpdateSchema>, P>(
  { permission: 'structure.manage', schema: campusUpdateSchema },
  async ({ request, user, scope, body, params }) => {
    ensure(scope.can('structure.manage'))
    if (body.leader !== undefined) ensure(scope.can('roles.manage'), 'Setting a leader needs permission to manage roles')
    const before = await load(params.id)
    const { leader, ...rest } = body
    await prisma.ccgCampus.update({ where: { id: params.id }, data: { ...rest, updatedAt: new Date() } })
    const leader_invite = leader !== undefined ? await setUnitLeader('campus', params.id, leader, user.id, new URL(request.url).origin) : null
    await logCcg({ userId: user.id, action: 'CAMPUS_UPDATED', entityType: 'ccg_campus', entityId: params.id, oldValues: before, newValues: body })
    return success({ id: params.id, leader_invite })
  }
)

/** DELETE /api/ccg/campuses/[id] — soft delete; its streams must be moved first. */
export const DELETE = withCcg<undefined, P>({ permission: 'structure.manage' }, async ({ user, scope, params }) => {
  ensure(scope.can('structure.manage'))
  await load(params.id)
  if (await prisma.ccgStream.count({ where: { campusId: params.id, deletedAt: null } })) {
    throw conflict('Move this campus’s streams to another campus first')
  }
  await prisma.$transaction([
    prisma.ccgRoleAssignment.updateMany({ where: { campusId: params.id, endsOn: null }, data: { endsOn: new Date() } }),
    prisma.ccgCampus.update({ where: { id: params.id }, data: { deletedAt: new Date(), status: 'inactive' } }),
  ])
  await logCcg({ userId: user.id, action: 'CAMPUS_DELETED', entityType: 'ccg_campus', entityId: params.id })
  return success({ id: params.id })
})
