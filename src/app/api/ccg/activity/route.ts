import type { Prisma } from '@prisma/client'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { iso, userRefs } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/activity?entity_type=&entity_id=&action=&limit=&offset= — the CCG audit trail (roles.manage). */
export const GET = withCcg({ permission: 'roles.manage' }, async ({ scope, query }) => {
  ensure(scope.can('roles.manage'))
  const limit = Math.min(Number(query.get('limit')) || 50, 200)
  const offset = Math.max(Number(query.get('offset')) || 0, 0)
  const where: Prisma.CcgActivityLogWhereInput = {
    ...(query.get('entity_type') ? { entityType: query.get('entity_type')! } : {}),
    ...(query.get('entity_id') ? { entityId: query.get('entity_id')! } : {}),
    ...(query.get('action') ? { action: query.get('action')! } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.ccgActivityLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    prisma.ccgActivityLog.count({ where }),
  ])
  const users = await userRefs(rows.map((r) => r.userId))
  return success(
    {
      activity: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entity_type: r.entityType,
        entity_id: r.entityId,
        user: r.userId ? users.get(r.userId) ?? null : null,
        old_values: r.oldValues,
        new_values: r.newValues,
        created_at: iso(r.createdAt),
      })),
    },
    { total, limit, offset, hasMore: offset + rows.length < total }
  )
})
