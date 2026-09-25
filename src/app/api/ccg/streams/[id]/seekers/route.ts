import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { addSeekerSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { addSeeker, streamTeam } from '@/lib/ccg/server/seekers'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/streams/[id]/seekers — the stream's Sheep Seeking Overseer and Sheep Seekers (anyone who sees the stream). */
export const GET = withCcg<undefined, { id: string }>({ permission: 'people.view' }, async ({ scope, params }) => {
  ensure(scope.canOnStream('people.view', params.id), 'You can only see your streams')
  return success(await streamTeam(params.id))
})

/**
 * POST /api/ccg/streams/[id]/seekers (roles.manage, or seekers.manage on the stream: its
 * Sheep Seeking Overseer) — appoint a Sheep Seeker:
 * `{ person_id }` for an existing member, or `{ first_name, middle_name?,
 * last_name, phone, email }` for someone new (added to the stream only, no CCF
 * needed). A matching email reuses that person. Returns `invite` when a login
 * was created.
 */
export const POST = withCcg<z.infer<typeof addSeekerSchema>, { id: string }>(
  { permission: 'seekers.manage', schema: addSeekerSchema },
  async ({ request, user, scope, params, body }) => {
    ensure(scope.can('roles.manage') || scope.canOnStream('seekers.manage', params.id), 'Only the stream’s Sheep Seeking Overseer or an admin can appoint Sheep Seekers')
    return created(await addSeeker(params.id, body, user.id, new URL(request.url).origin))
  }
)
