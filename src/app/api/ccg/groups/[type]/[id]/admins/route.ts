import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { addSeekerSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { adminLevel, canAppointAdmins } from '@/lib/ccg/server/admin-access'
import { addUnitAdmin, unitAdmins } from '@/lib/ccg/server/roles'
import { canSeeUnit } from '@/lib/ccg/server/unit-overview'

export const dynamic = 'force-dynamic'
type P = { type: string; id: string }

/** GET /api/ccg/groups/[type]/[id]/admins — a stream's, council's or CCG's admins, and whether the viewer may appoint them. */
export const GET = withCcg<undefined, P>({}, async ({ scope, params }) => {
  const level = adminLevel(params.type)
  ensure(canSeeUnit(scope, level, params.id), 'You can only view units in your scope')
  return success({ admins: await unitAdmins(level, params.id), can_appoint: canAppointAdmins(scope, level, params.id) })
})

/**
 * POST /api/ccg/groups/[type]/[id]/admins — add an admin (admins.appoint on the unit:
 * its leader or those above it): `{ person_id }` or a new person's details. They are emailed.
 */
export const POST = withCcg<z.infer<typeof addSeekerSchema>, P>({ schema: addSeekerSchema }, async ({ request, user, scope, params, body }) => {
  const level = adminLevel(params.type)
  ensure(canAppointAdmins(scope, level, params.id), 'Only the leader of this unit, or someone above it, appoints its admins')
  return created(await addUnitAdmin(level, params.id, body, user.id, new URL(request.url).origin))
})
