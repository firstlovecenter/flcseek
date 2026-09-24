import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { conflict, notFound } from '@/lib/ccg/errors'
import { streamUpdateSchema } from '@/lib/ccg/schemas'
import { iso, logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { serializeCouncil } from '@/lib/ccg/server/units'

export const dynamic = 'force-dynamic'
type P = { id: string }

async function load(id: string) {
  const s = await prisma.ccgStream.findFirst({ where: { id, deletedAt: null } })
  if (!s) throw notFound('Stream')
  return s
}

/** GET /api/ccg/streams/[id] — the stream and its councils. */
export const GET = withCcg<undefined, P>({}, async ({ params }) => {
  const s = await load(params.id)
  const councils = await prisma.ccgCouncil.findMany({
    where: { streamId: s.id, deletedAt: null },
    include: { _count: { select: { groups: { where: { deletedAt: null } } } } },
    orderBy: { code: 'asc' },
  })
  return success({
    stream: { id: s.id, code: s.code, name: s.name, status: s.status, notes: s.notes, created_at: iso(s.createdAt) },
    councils: councils.map((c) => serializeCouncil(c, { ccg_count: c._count.groups })),
  })
})

/** PATCH /api/ccg/streams/[id] (structure.manage) */
export const PATCH = withCcg<z.infer<typeof streamUpdateSchema>, P>(
  { permission: 'structure.manage', schema: streamUpdateSchema },
  async ({ user, scope, body, params }) => {
    ensure(scope.can('structure.manage'))
    const before = await load(params.id)
    await prisma.ccgStream.update({ where: { id: params.id }, data: { ...body, updatedAt: new Date() } })
    await logCcg({ userId: user.id, action: 'STREAM_UPDATED', entityType: 'ccg_stream', entityId: params.id, oldValues: before, newValues: body })
    return success({ id: params.id })
  }
)

/** DELETE /api/ccg/streams/[id] — soft delete; its councils must be moved first. */
export const DELETE = withCcg<undefined, P>({ permission: 'structure.manage' }, async ({ user, scope, params }) => {
  ensure(scope.can('structure.manage'))
  await load(params.id)
  if (await prisma.ccgCouncil.count({ where: { streamId: params.id, deletedAt: null } })) {
    throw conflict('Move this stream’s councils to another stream first')
  }
  await prisma.$transaction([
    prisma.ccgRoleAssignment.updateMany({ where: { streamId: params.id, endsOn: null }, data: { endsOn: new Date() } }),
    prisma.ccgStream.update({ where: { id: params.id }, data: { deletedAt: new Date(), status: 'inactive' } }),
  ])
  await logCcg({ userId: user.id, action: 'STREAM_DELETED', entityType: 'ccg_stream', entityId: params.id })
  return success({ id: params.id })
})
