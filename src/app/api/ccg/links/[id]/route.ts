import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/ccg/errors'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { revokeLink } from '@/lib/ccg/server/links'

export const dynamic = 'force-dynamic'

/** DELETE /api/ccg/links/[id] — revoke; the link stops working immediately. */
export const DELETE = withCcg<undefined, { id: string }>({}, async ({ user, scope, params }) => {
  const l = await prisma.ccgFormLink.findUnique({ where: { id: params.id } })
  if (!l) throw notFound('Link')
  if (l.kind === 'member_ccf') ensure(scope.canOnCcf('links.manage', l.ccfId))
  else if (l.kind === 'convert_intake') ensure(scope.can('links.intake') || scope.canOnStream('links.intake', l.streamId))
  else ensure(scope.can('people.manage') || l.createdBy === user.id)
  await revokeLink(l.id, user.id)
  return success({ id: l.id, revoked: true })
})
