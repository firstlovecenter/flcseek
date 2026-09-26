import { prisma } from '@/lib/prisma'
import type { Permission } from '../permissions'
import { inFilter, type CcgScope, type IdSet } from '../scope'

/** Holds at least one of these permissions somewhere. */
export const holdsAny = (scope: CcgScope, ...perms: Permission[]) => perms.some((p) => scope.anywhere.has(p))

/** Sees the whole structure: church-wide viewers and the people who build it or hand out roles. */
const seesAll = (scope: CcgScope) => scope.can('people.view') || scope.can('structure.manage') || scope.can('roles.manage')

/** Streams the viewer works in: stream and campus roles, and the streams of the CCGs and CCFs they lead. */
export async function visibleStreamIds(scope: CcgScope): Promise<IdSet> {
  if (seesAll(scope)) return 'all'
  const direct = scope.streamIds('people.view') as string[]
  const ccfs = inFilter(scope.ccfIds('people.view'))
  const viaUnits = ccfs
    ? await prisma.ccgGroup.findMany({ where: { deletedAt: null, families: { some: { id: ccfs, deletedAt: null } } }, select: { streamId: true } })
    : []
  return [...new Set([...direct, ...viaUnits.map((g) => g.streamId)])]
}

/** Campuses the viewer leads (or all, for church-wide viewers). */
export async function visibleCampusIds(scope: CcgScope): Promise<IdSet> {
  if (seesAll(scope)) return 'all'
  const campuses = await prisma.ccgCampus.findMany({ where: { deletedAt: null }, select: { id: true } })
  return campuses.filter((c) => scope.canOnCampus('people.view', c.id)).map((c) => c.id)
}
