import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere, isSeekSuperadmin } from '@/lib/ccg/access'
import { PERMISSION_KEYS } from '@/lib/ccg/permissions'
import { dateOnly, userDisplayName } from '@/lib/ccg/server/common'
import { withCcg } from '@/lib/ccg/server/handler'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/me — who I am in CCG: roles (with units) and permissions. */
export const GET = withCcg({}, async ({ user, scope }) => {
  const [u, assignments] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { id: true, username: true, firstName: true, lastName: true, role: true } }),
    prisma.ccgRoleAssignment.findMany({
      where: { userId: user.id, ...currentAssignmentWhere() },
      include: { role: true, stream: true, council: true, ccg: true, ccf: true },
      orderBy: { role: { sortOrder: 'asc' } },
    }),
  ])
  return success({
    user: { id: user.id, username: u?.username ?? user.username, name: u ? userDisplayName(u) : user.username },
    /** Seek superadmins have every CCG permission everywhere, without an assignment. */
    is_superadmin: isSeekSuperadmin(u?.role),
    roles: assignments.map((a) => ({
      assignment_id: a.id,
      role: { key: a.role.key, name: a.role.name, scope_level: a.role.scopeLevel },
      unit: a.stream
        ? { type: 'stream', id: a.stream.id, name: a.stream.name }
        : a.council
        ? { type: 'council', id: a.council.id, name: a.council.name }
        : a.ccg
          ? { type: 'ccg', id: a.ccg.id, name: a.ccg.name }
          : a.ccf
            ? { type: 'ccf', id: a.ccf.id, name: a.ccf.name }
            : null,
      starts_on: dateOnly(a.startsOn),
      ends_on: dateOnly(a.endsOn),
    })),
    /** Permissions held somewhere (for menus). */
    permissions: PERMISSION_KEYS.filter((p) => scope.anywhere.has(p)),
    /** Permissions held everywhere. */
    global_permissions: PERMISSION_KEYS.filter((p) => scope.can(p)),
  })
})
