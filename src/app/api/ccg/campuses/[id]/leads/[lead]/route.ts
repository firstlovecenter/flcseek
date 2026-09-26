import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { addSeekerSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { asLead, ensureCanAppointCampusLead, standDownLead } from '@/lib/ccg/server/seeking-leads'
import { setCampusSeekingLead } from '@/lib/ccg/server/seekers'

export const dynamic = 'force-dynamic'
type P = { id: string; lead: string }

/**
 * PUT /api/ccg/campuses/[id]/leads/admin|overseer (central team) — appoint the
 * campus's Sheep Seeking Admin (acts across its streams) or Overseer (view
 * only): `{ person_id }` or a new person's details. The current one stands down.
 */
export const PUT = withCcg<z.infer<typeof addSeekerSchema>, P>({ schema: addSeekerSchema }, async ({ request, user, scope, params, body }) => {
  const lead = asLead(params.lead)
  ensureCanAppointCampusLead(scope)
  return success(await setCampusSeekingLead(params.id, lead, body, user.id, new URL(request.url).origin))
})

/** DELETE /api/ccg/campuses/[id]/leads/admin|overseer — stand the current one down. */
export const DELETE = withCcg<undefined, P>({}, async ({ user, scope, params }) => {
  const lead = asLead(params.lead)
  ensureCanAppointCampusLead(scope)
  await standDownLead({ campusId: params.id }, lead, user.id)
  return success({ id: params.id })
})
