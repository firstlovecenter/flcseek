import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere } from '@/lib/ccg/access'
import { conflict, notFound } from '@/lib/ccg/errors'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/ccg/people/[id]/login (roles.manage) — unlink a member's login;
 * refused while they hold any role. Logins are created when a member is first
 * given a role (POST /api/ccg/assignments, or a unit's `leader`).
 */
export const DELETE = withCcg<undefined, { id: string }>({ permission: 'roles.manage' }, async ({ user, scope, params }) => {
  ensure(scope.can('roles.manage'))
  const p = await prisma.ccgPerson.findFirst({ where: { id: params.id, deletedAt: null } })
  if (!p) throw notFound('Person')
  if (!p.userId) return success({ id: p.id })
  const roles = await prisma.ccgRoleAssignment.count({ where: { userId: p.userId, ...currentAssignmentWhere() } })
  if (roles) throw conflict('End their roles first')
  await prisma.ccgPerson.update({ where: { id: p.id }, data: { userId: null, updatedAt: new Date() } })
  await logCcg({ userId: user.id, action: 'MEMBER_LOGIN_UNLINKED', entityType: 'ccg_person', entityId: p.id, oldValues: { user_id: p.userId } })
  return success({ id: p.id })
})
