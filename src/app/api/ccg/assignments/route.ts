import type { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { assignmentSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { assignRoleToMember, assignmentInclude, createAssignment, serializeAssignment } from '@/lib/ccg/server/roles'
import { isCcgOwner } from '@/lib/ccg/access'
import { invalid } from '@/lib/ccg/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/assignments?user_id=&role_key=&stream_id=&council_id=&ccg_id=&ccf_id=&include_ended=1
 * Who holds which role where (roles.manage).
 */
export const GET = withCcg({ permission: 'roles.manage' }, async ({ scope, query }) => {
  ensure(scope.can('roles.manage'))
  const where: Prisma.CcgRoleAssignmentWhereInput = {
    ...(query.get('include_ended') === '1' ? {} : { endsOn: null }),
    ...(query.get('user_id') ? { userId: query.get('user_id')! } : {}),
    ...(query.get('role_key') ? { roleKey: query.get('role_key')! } : {}),
    ...(query.get('stream_id') ? { streamId: query.get('stream_id')! } : {}),
    ...(query.get('council_id') ? { councilId: query.get('council_id')! } : {}),
    ...(query.get('ccg_id') ? { ccgId: query.get('ccg_id')! } : {}),
    ...(query.get('ccf_id') ? { ccfId: query.get('ccf_id')! } : {}),
  }
  const rows = await prisma.ccgRoleAssignment.findMany({
    where,
    include: assignmentInclude,
    orderBy: [{ role: { sortOrder: 'asc' } }, { createdAt: 'desc' }],
    take: 500,
  })
  return success({ assignments: rows.map(serializeAssignment) })
})

/**
 * POST /api/ccg/assignments (roles.manage) — give a member a role over a unit.
 * A member without a login gets one (their email is the sign-in name) and is
 * emailed a link to choose a password; `invite` says whether it was sent.
 */
export const POST = withCcg<z.infer<typeof assignmentSchema>>(
  { permission: 'roles.manage', schema: assignmentSchema },
  async ({ request, user, scope, body }) => {
    ensure(scope.can('roles.manage'))
    const { person_id, user_id, ...rest } = body
    if (user_id) {
      // Any user, including Seek users with no CCG profile: the owner's call only.
      ensure(await isCcgOwner(user.id), 'Only the CCG owner can give roles to users who are not members')
      const assignment = await createAssignment({ ...rest, user_id }, user.id, undefined, { linkOnly: true })
      return created({ assignment: serializeAssignment(assignment), invite: null })
    }
    if (!person_id) throw invalid('Choose a member or a user')
    const { assignment, invite } = await assignRoleToMember({ ...rest, person_id }, user.id, new URL(request.url).origin)
    return created({ assignment: serializeAssignment(assignment), invite })
  }
)
