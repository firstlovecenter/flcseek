import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere } from '@/lib/ccg/access'
import { invalid, notFound } from '@/lib/ccg/errors'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { sendInvite } from '@/lib/ccg/server/member-login'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ccg/people/[id]/invite (roles.manage) — email a member with a role
 * a new link to set their password (the old link stops working). Also serves
 * when they have forgotten it.
 */
export const POST = withCcg<undefined, { id: string }>({ permission: 'roles.manage' }, async ({ request, user, scope, params }) => {
  ensure(scope.can('roles.manage'))
  const p = await prisma.ccgPerson.findFirst({ where: { id: params.id, deletedAt: null } })
  if (!p) throw notFound('Person')
  if (!p.userId) throw invalid('Give them a role first: their login is created then')
  const a = await prisma.ccgRoleAssignment.findFirst({
    where: { userId: p.userId, ...currentAssignmentWhere() },
    include: { role: true, stream: true, council: true, ccg: true, ccf: true },
    orderBy: { createdAt: 'desc' },
  })
  const invite = await sendInvite({
    personId: p.id,
    role: a?.role.name ?? 'a leader',
    unit: a ? (a.ccf ?? a.ccg ?? a.council ?? a.stream)?.name ?? null : null,
    origin: new URL(request.url).origin,
    actorId: user.id,
  })
  return success({ invite })
})
