import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/ccg/errors'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { placementListInclude, serializePlacement } from '@/lib/ccg/server/placement-dto'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/placements/[id] — one placement with its match reasons. */
export const GET = withCcg<undefined, { id: string }>({ permission: 'placements.view' }, async ({ scope, params }) => {
  const p = await prisma.ccgPlacement.findUnique({ where: { id: params.id }, include: placementListInclude })
  if (!p) throw notFound('Placement')
  ensure(scope.canOnCcf('placements.view', p.finalCcfId ?? p.proposedCcfId), 'You can only view placements in your scope')
  return success({ placement: serializePlacement(p) })
})
