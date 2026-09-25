import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere, isSeekSuperadmin } from '../access'
import { PERMISSION_KEYS, type ScopeLevel } from '../permissions'
import { resolveCcgScope, type AssignmentGrant, type CcgScope, type Hierarchy } from '../scope'

/** Seek superadmins hold every CCG permission everywhere (not stored as an assignment). */
export const SEEK_SUPERADMIN_GRANT: AssignmentGrant = {
  roleKey: 'seek_superadmin',
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
  const [user, member, assignments, hierarchy] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, deletedAt: true } }),
    prisma.ccgPerson.findFirst({ where: { userId, kind: 'member', deletedAt: null }, select: { id: true } }),
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
  if (user && !user.deletedAt && isSeekSuperadmin(user.role)) grants.unshift(SEEK_SUPERADMIN_GRANT)
  return resolveCcgScope(grants, hierarchy, { memberId: member?.id ?? null })
}
