import { prisma } from '@/lib/prisma'
import { notFound } from '../errors'
import type { Permission } from '../permissions'
import type { CcgScope } from '../scope'
import { ensure } from './handler'

/**
 * Load a placement and check `perm` on the CCF it concerns (final for active /
 * ended, proposed for open), or on the stream that registered the convert.
 * Held placements with no CCF and no stream need the permission globally.
 */
export async function authorisePlacement(scope: CcgScope, perm: Permission, placementId: string) {
  const p = await prisma.ccgPlacement.findUnique({
    where: { id: placementId },
    select: { id: true, status: true, proposedCcfId: true, finalCcfId: true, personId: true, person: { select: { streamId: true } } },
  })
  if (!p) throw notFound('Placement')
  const ccf = p.finalCcfId ?? p.proposedCcfId
  ensure(scope.can(perm) || (!!ccf && scope.canOnCcf(perm, ccf)) || scope.canOnStream(perm, p.person.streamId))
  return p
}
