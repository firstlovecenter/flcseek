import { prisma } from '@/lib/prisma'
import { notFound } from '../errors'
import type { Permission } from '../permissions'
import type { CcgScope } from '../scope'
import { ensure } from './handler'

/**
 * Load a placement and check `perm` on the CCF it concerns (final for active /
 * ended, proposed for open), or on the stream that registered the convert.
 * Held placements with no CCF and no stream need the permission globally. A
 * Sheep Seeking Liaison also acts on the converts placed in their CCFs.
 */
export async function authorisePlacement(scope: CcgScope, perm: Permission, placementId: string) {
  const p = await prisma.ccgPlacement.findUnique({
    where: { id: placementId },
    select: { id: true, status: true, proposedCcfId: true, finalCcfId: true, personId: true, person: { select: { streamId: true } } },
  })
  if (!p) throw notFound('Placement')
  // A CCF reaches its placements once approved; a proposal only through the Sheep Seeking side.
  ensure(
    scope.can(perm) ||
      (!!p.finalCcfId && scope.canOnCcf(perm, p.finalCcfId)) ||
      scope.sheepSeeking().canOnStream(perm, p.person.streamId) ||
      // (only while the convert is still theirs to follow: graduated converts are CCF members, read-only)
      (p.status === 'active' && scope.canAsLiaison(perm, p.finalCcfId))
  )
  return p
}
