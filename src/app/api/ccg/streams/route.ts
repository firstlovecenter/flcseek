import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { streamSchema } from '@/lib/ccg/schemas'
import { iso, logCcg } from '@/lib/ccg/server/common'
import { createWithCode } from '@/lib/ccg/server/units'
import { ensure, withCcg } from '@/lib/ccg/server/handler'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/streams — with council counts. */
export const GET = withCcg({}, async () => {
  const streams = await prisma.ccgStream.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { councils: { where: { deletedAt: null } } } } },
    orderBy: { name: 'asc' },
  })
  return success({
    streams: streams.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      status: s.status,
      notes: s.notes,
      council_count: s._count.councils,
      created_at: iso(s.createdAt),
    })),
  })
})

/** POST /api/ccg/streams (structure.manage) */
export const POST = withCcg<z.infer<typeof streamSchema>>(
  { permission: 'structure.manage', schema: streamSchema },
  async ({ user, scope, body }) => {
    ensure(scope.can('structure.manage'))
    const s = await createWithCode('stream', body.code, (code) =>
      prisma.ccgStream.create({ data: { code, name: body.name, status: body.status, notes: body.notes ?? null, createdBy: user.id } })
    )
    await logCcg({ userId: user.id, action: 'STREAM_CREATED', entityType: 'ccg_stream', entityId: s.id, newValues: body })
    return created({ id: s.id })
  }
)
