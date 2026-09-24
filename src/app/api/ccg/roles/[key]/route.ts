import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { notFound } from '@/lib/ccg/errors'
import { roleUpdateSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { withRolesManageKept } from '@/lib/ccg/server/roles'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/ccg/roles/[key] (roles.manage) — rename, change permissions or
 * (de)activate. The key and level are fixed. Refused if it would leave
 * nobody able to manage roles.
 */
export const PATCH = withCcg<z.infer<typeof roleUpdateSchema>, { key: string }>(
  { permission: 'roles.manage', schema: roleUpdateSchema },
  async ({ user, scope, body, params }) => {
    ensure(scope.can('roles.manage'))
    await withRolesManageKept(async (tx) => {
      const before = await tx.ccgRole.findUnique({ where: { key: params.key } })
      if (!before) throw notFound('Role')
      await tx.ccgRole.update({
        where: { key: params.key },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.permissions !== undefined ? { permissions: body.permissions } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
          ...(body.sort_order !== undefined ? { sortOrder: body.sort_order } : {}),
          updatedAt: new Date(),
        },
      })
      await logCcg({ userId: user.id, action: 'ROLE_UPDATED', entityType: 'ccg_role', oldValues: before, newValues: body }, tx)
    })
    return success({ key: params.key })
  }
)
