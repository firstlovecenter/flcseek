import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/ccg/errors'
import { withCcg } from '@/lib/ccg/server/handler'
import { placementListInclude, serializePlacement } from '@/lib/ccg/server/placement-dto'
import { authorisePlacement } from '@/lib/ccg/server/placement-routes'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/placements/[id] — one placement with its match reasons. */
export const GET = withCcg<undefined, { id: string }>({ permission: 'placements.view' }, async ({ scope, params }) => {
  await authorisePlacement(scope, 'placements.view', params.id)
  const p = await prisma.ccgPlacement.findUnique({ where: { id: params.id }, include: placementListInclude })
  if (!p) throw notFound('Placement')
  return success({ placement: serializePlacement(p) })
})
