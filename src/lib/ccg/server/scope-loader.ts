import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere } from '../access'
import { PERMISSION_KEYS, type ScopeLevel } from '../permissions'
import { resolveCcgScope, type AssignmentGrant, type CcgScope, type Hierarchy } from '../scope'

/** CCG owners (ccg_owners) hold every CCG permission everywhere (not stored as an assignment). */
export const OWNER_GRANT: AssignmentGrant = {
  roleKey: 'ccg_owner',
  scopeLevel: 'global',
  permissions: [...PERMISSION_KEYS],
  campusId: null,
  streamId: null,
  councilId: null,
  ccgId: null,
  ccfId: null,
}

/** The live stream → council → CCG → CCF tree (soft-deleted units excluded). */
export async function loadHierarchy(): Promise<Hierarchy> {
  const [ccfs, ccgs, councils, streams] = await Promise.all([
    prisma.ccgFamily.findMany({ where: { deletedAt: null, ccg: { deletedAt: null } }, select: { id: true, ccgId: true } }),
    prisma.ccgGroup.findMany({ where: { deletedAt: null }, select: { id: true, councilId: true } }),
    prisma.ccgCouncil.findMany({ where: { deletedAt: null }, select: { id: true, streamId: true } }),
    prisma.ccgStream.findMany({ where: { deletedAt: null }, select: { id: true, campusId: true } }),
  ])
  return { ccfs, ccgs, councils, streams }
}

/** Resolve what a user may do, from their current role assignments. */
export async function loadScope(userId: string): Promise<CcgScope> {
  const [user, groups, assignments, hierarchy] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { deletedAt: true, ccgOwner: { select: { userId: true } } } }),
    prisma.ccgSeekingGroupSeeker.findMany({ where: { userId, group: { deletedAt: null, status: 'active' } }, select: { groupId: true } }),
    prisma.ccgRoleAssignment.findMany({
      where: { userId, ...currentAssignmentWhere() },
      include: { role: true },
    }),
    loadHierarchy(),
  ])
  const grants: AssignmentGrant[] = assignments.map((a) => ({
    roleKey: a.roleKey,
    scopeLevel: a.role.scopeLevel as ScopeLevel,
    permissions: a.role.permissions,
    campusId: a.campusId,
    streamId: a.streamId,
    councilId: a.councilId,
    ccgId: a.ccgId,
    ccfId: a.ccfId,
  }))
  if (user && !user.deletedAt && user.ccgOwner) grants.unshift(OWNER_GRANT)
  return resolveCcgScope(grants, hierarchy, { seekingGroupIds: groups.map((g) => g.groupId) })
}
