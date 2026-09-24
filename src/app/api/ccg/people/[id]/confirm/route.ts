import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/ccg/errors'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { confirmMember } from '@/lib/ccg/server/people'

export const dynamic = 'force-dynamic'

/** POST /api/ccg/people/[id]/confirm — a self-registered member starts counting in their CCF's profile. */
export const POST = withCcg<undefined, { id: string }>({ permission: 'members.confirm' }, async ({ user, scope, params }) => {
  const p = await prisma.ccgPerson.findFirst({ where: { id: params.id, deletedAt: null } })
  if (!p) throw notFound('Member')
  ensure(scope.canOnCcf('members.confirm', p.ccfId), 'You can only confirm members of CCFs in your scope')
  await confirmMember(p.id, user.id)
  return success({ id: p.id, status: 'active' })
})
