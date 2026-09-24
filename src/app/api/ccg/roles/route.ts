import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/ccg/permissions'
import { roleSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { serializeRole } from '@/lib/ccg/server/roles'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/roles — roles with assignment counts, and the permission catalogue. */
export const GET = withCcg({}, async () => {
  const roles = await prisma.ccgRole.findMany({
    include: { _count: { select: { assignments: { where: { endsOn: null } } } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return success({
    roles: roles.map((r) => serializeRole(r, { assignments: r._count.assignments })),
    permissions: Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description })),
  })
})

/** POST /api/ccg/roles (roles.manage) — a new role is just a named set of permissions at a level. */
export const POST = withCcg<z.infer<typeof roleSchema>>({ permission: 'roles.manage', schema: roleSchema }, async ({ user, scope, body }) => {
  ensure(scope.can('roles.manage'))
  const r = await prisma.ccgRole.create({
    data: {
      key: body.key,
      name: body.name,
      description: body.description ?? null,
      scopeLevel: body.scope_level,
      permissions: body.permissions,
      sortOrder: body.sort_order,
    },
  })
  await logCcg({ userId: user.id, action: 'ROLE_CREATED', entityType: 'ccg_role', newValues: body })
  return created({ key: r.key })
})
