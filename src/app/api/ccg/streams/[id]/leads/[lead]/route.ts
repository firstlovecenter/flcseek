import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { addSeekerSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { asLead, ensureCanAppointStreamLead, standDownLead } from '@/lib/ccg/server/seeking-leads'
import { setStreamSeekingLead } from '@/lib/ccg/server/seekers'

export const dynamic = 'force-dynamic'
type P = { id: string; lead: string }

/**
 * PUT /api/ccg/streams/[id]/leads/admin|overseer — appoint the stream's Sheep
 * Seeking Admin (acts) or Overseer (view only): `{ person_id }` or a new
 * person's details. The current one stands down. By the central team or the
 * campus's Sheep Seeking Admin.
 */
export const PUT = withCcg<z.infer<typeof addSeekerSchema>, P>({ schema: addSeekerSchema }, async ({ request, user, scope, params, body }) => {
  const lead = asLead(params.lead)
  await ensureCanAppointStreamLead(scope, params.id)
  return success(await setStreamSeekingLead(params.id, lead, body, user.id, new URL(request.url).origin))
})

/** DELETE /api/ccg/streams/[id]/leads/admin|overseer — stand the current one down. */
export const DELETE = withCcg<undefined, P>({}, async ({ user, scope, params }) => {
  const lead = asLead(params.lead)
  await ensureCanAppointStreamLead(scope, params.id)
  await standDownLead({ streamId: params.id }, lead, user.id)
  return success({ id: params.id })
})
