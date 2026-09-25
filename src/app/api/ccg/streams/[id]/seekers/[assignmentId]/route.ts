import { success } from '@/lib/api/response'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { standDownSeeker } from '@/lib/ccg/server/seekers'

export const dynamic = 'force-dynamic'

/** DELETE /api/ccg/streams/[id]/seekers/[assignmentId] — stand a Sheep Seeker down (roles.manage, or the stream's Sheep Seeking Overseer). */
export const DELETE = withCcg<undefined, { id: string; assignmentId: string }>({ permission: 'seekers.manage' }, async ({ user, scope, params }) => {
  ensure(scope.can('roles.manage') || scope.canOnStream('seekers.manage', params.id), 'Only the stream’s Sheep Seeking Overseer or an admin can stand Sheep Seekers down')
  await standDownSeeker(params.id, params.assignmentId, user.id)
  return success({ ok: true })
})
