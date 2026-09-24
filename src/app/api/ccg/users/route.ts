import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere, isSeekSuperadmin, SEEK_SUPERADMIN } from '@/lib/ccg/access'
import { userDisplayName } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/users?search=&members=1 (roles.manage)
 * Without search: users with CCG access (a current CCG role, or Seek
 * superadmin). With search: any user (to give an existing Seek user a role).
 * members=1: only logins linked to active members (leaders are chosen from members).
 */
export const GET = withCcg({ permission: 'roles.manage' }, async ({ scope, query }) => {
  ensure(scope.can('roles.manage'))
  const search = query.get('search')?.trim()
  const membersOnly = query.get('members') === '1'
  const memberLink = { ccgPeople: { some: { kind: 'member', status: 'active', deletedAt: null } } }
  const users = await prisma.user.findMany({
    where: {
      AND: [
        search
          ? {
              deletedAt: null,
              OR: [
                { username: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : membersOnly
            ? { deletedAt: null }
            : { deletedAt: null, OR: [{ ccgRoleAssignments: { some: currentAssignmentWhere() } }, { role: SEEK_SUPERADMIN }] },
        membersOnly ? memberLink : {},
      ],
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      role: true,
      ccgRoleAssignments: { where: currentAssignmentWhere(), include: { role: true } },
      ccgPeople: {
        where: { kind: 'member', deletedAt: null },
        select: { id: true, fullName: true, status: true, ccf: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ firstName: 'asc' }, { username: 'asc' }],
    take: search ? 25 : 1000,
  })
  return success({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      name: userDisplayName(u),
      email: u.email,
      phone_number: u.phoneNumber,
      has_seek_access: !!u.role,
      is_superadmin: isSeekSuperadmin(u.role),
      ccg_roles: [...new Set(u.ccgRoleAssignments.map((a) => a.role.name))],
      member: u.ccgPeople[0]
        ? { id: u.ccgPeople[0].id, full_name: u.ccgPeople[0].fullName, status: u.ccgPeople[0].status, ccf: u.ccgPeople[0].ccf }
        : null,
    })),
  })
})
