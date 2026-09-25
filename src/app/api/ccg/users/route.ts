import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere, isCcgOwner } from '@/lib/ccg/access'
import { userDisplayName } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/users?search=&all=1&members=1 (roles.manage)
 * Without search: users with CCG access (a current CCG role, or the owner).
 * With search: any user (to give an existing Seek user a role).
 * all=1 (the CCG owner only): every user, Seek's included.
 * members=1: only logins linked to active members (leaders are chosen from members).
 */
export const GET = withCcg({ permission: 'roles.manage' }, async ({ user, scope, query }) => {
  ensure(scope.can('roles.manage'))
  const everyone = query.get('all') === '1'
  if (everyone) ensure(await isCcgOwner(user.id), 'Only the CCG owner sees every user')
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
          : membersOnly || everyone
            ? { deletedAt: null }
            : { deletedAt: null, OR: [{ ccgRoleAssignments: { some: currentAssignmentWhere() } }, { ccgOwner: { isNot: null } }] },
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
      ccgOwner: { select: { userId: true } },
      ccgRoleAssignments: {
        where: currentAssignmentWhere(),
        include: { role: true, campus: true, stream: true, council: true, ccg: true, ccf: true },
      },
      ccgPeople: {
        where: { kind: 'member', deletedAt: null },
        select: { id: true, fullName: true, status: true, ccf: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ firstName: 'asc' }, { username: 'asc' }],
    take: search ? 25 : 2000,
  })
  return success({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      name: userDisplayName(u),
      email: u.email,
      phone_number: u.phoneNumber,
      has_seek_access: !!u.role,
      /** Their Seek role (superadmin, leadpastor, admin, leader), if any. */
      seek_role: u.role,
      /** The CCG owner (full CCG access). */
      is_superadmin: !!u.ccgOwner,
      ccg_roles: [...new Set(u.ccgRoleAssignments.map((a) => a.role.name))],
      /** Current CCG roles with where they apply (to end one). */
      assignments: u.ccgRoleAssignments.map((a) => ({
        id: a.id,
        role: { key: a.role.key, name: a.role.name },
        unit: (a.ccf ?? a.ccg ?? a.council ?? a.stream ?? a.campus)?.name ?? null,
      })),
      member: u.ccgPeople[0]
        ? { id: u.ccgPeople[0].id, full_name: u.ccgPeople[0].fullName, status: u.ccgPeople[0].status, ccf: u.ccgPeople[0].ccf }
        : null,
    })),
  })
})
