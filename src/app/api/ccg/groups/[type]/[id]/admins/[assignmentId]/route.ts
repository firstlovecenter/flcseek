import { success } from '@/lib/api/response'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { standDownUnitAdmin } from '@/lib/ccg/server/roles'
import { adminLevel, canAppointAdmins } from '@/lib/ccg/server/admin-access'

export const dynamic = 'force-dynamic'

/** DELETE /api/ccg/groups/[type]/[id]/admins/[assignmentId] — stand one admin down (admins.appoint on the unit). */
export const DELETE = withCcg<undefined, { type: string; id: string; assignmentId: string }>({}, async ({ user, scope, params }) => {
  const level = adminLevel(params.type)
  ensure(canAppointAdmins(scope, level, params.id), 'Only the leader of this unit, or someone above it, stands its admins down')
  await standDownUnitAdmin(level, params.id, params.assignmentId, user.id)
  return success({ id: params.assignmentId })
})
