import { isPermission, type Permission, type ScopeLevel } from './permissions'

/**
 * What a user may do, and where. Pure: the caller supplies the user's current
 * role assignments and the campus → stream → council → CCG → CCF hierarchy.
 *
 * A grant at a level covers everything beneath it: a campus grant covers its
 * streams; a stream grant covers its
 * councils; an Overseer's council grant covers its CCGs and their CCFs; a
 * Governor's CCG grant covers its CCFs.
 */

export interface AssignmentGrant {
  roleKey: string
  scopeLevel: ScopeLevel
  permissions: string[]
  campusId?: string | null
  streamId?: string | null
  councilId: string | null
  ccgId: string | null
  ccfId: string | null
}

export interface Hierarchy {
  ccfs: Array<{ id: string; ccgId: string }>
  ccgs: Array<{ id: string; councilId: string | null }>
  councils?: Array<{ id: string; streamId: string | null }>
  streams?: Array<{ id: string; campusId: string | null }>
}

export type IdSet = 'all' | string[]

export interface CcgScope {
  roleKeys: string[]
  /** Permissions held anywhere (for menus). */
  anywhere: Set<Permission>
  /** Held globally. */
  can(perm: Permission): boolean
  canOnCcf(perm: Permission, ccfId: string | null | undefined): boolean
  canOnCcg(perm: Permission, ccgId: string | null | undefined): boolean
  canOnCouncil(perm: Permission, councilId: string | null | undefined): boolean
  canOnStream(perm: Permission, streamId: string | null | undefined): boolean
  canOnCampus(perm: Permission, campusId: string | null | undefined): boolean
  /** CCFs where `perm` applies. */
  ccfIds(perm: Permission): IdSet
  /** CCGs where `perm` applies (at CCG level or above). */
  ccgIds(perm: Permission): IdSet
  /** Councils where `perm` applies (at council level or above). */
  councilIds(perm: Permission): IdSet
  /** Streams where `perm` applies (at stream level or globally). */
  streamIds(perm: Permission): IdSet
  /** The sheep seeking groups this Sheep Seeker is assigned to: their converts are in reach wherever they are placed. */
  seekingGroupIds: string[]
  /** `perm` on a convert in one of this Sheep Seeker's groups (with the Sheep Seeker role's permissions). */
  canOnSeekingGroup(perm: Permission, groupId: string | null | undefined): boolean
  /**
   * `perm` on a CCF's members. Sheep seeking roles reach converts only, so
   * this counts CCF, CCG, council and church-wide leadership roles alone.
   */
  canOnMembersOf(perm: Permission, ccfId: string | null | undefined): boolean
  /** CCFs whose members `perm` reaches (see canOnMembersOf). */
  memberCcfIds(perm: Permission): IdSet
  /** The same scope counting leadership roles only (City Church Groups side): group pages and structure. */
  leadership(): CcgScope
}

/** Roles on the Sheep Seeking side: they work with converts, never with CCF members. */
export const SEEKING_ROLES: readonly string[] = ['sheep_seeker', 'seeking_overseer']

type Grants = Map<string, Set<Permission>>

function add(map: Grants, id: string, perms: Permission[]) {
  const set = map.get(id) ?? new Set<Permission>()
  perms.forEach((p) => set.add(p))
  map.set(id, set)
}

export function resolveCcgScope(assignments: AssignmentGrant[], hierarchy: Hierarchy, self: { seekingGroupIds?: string[] } = {}): CcgScope {
  const global = new Set<Permission>()
  const byCampus: Grants = new Map()
  const byStream: Grants = new Map()
  const byCouncil: Grants = new Map()
  const byCcg: Grants = new Map()
  const byCcf: Grants = new Map()
  const anywhere = new Set<Permission>()

  for (const a of assignments) {
    const perms = a.permissions.filter(isPermission)
    let granted = true
    if (a.scopeLevel === 'global') perms.forEach((p) => global.add(p))
    else if (a.scopeLevel === 'campus' && a.campusId) add(byCampus, a.campusId, perms)
    else if (a.scopeLevel === 'stream' && a.streamId) add(byStream, a.streamId, perms)
    else if (a.scopeLevel === 'council' && a.councilId) add(byCouncil, a.councilId, perms)
    else if (a.scopeLevel === 'ccg' && a.ccgId) add(byCcg, a.ccgId, perms)
    else if (a.scopeLevel === 'ccf' && a.ccfId) add(byCcf, a.ccfId, perms)
    else granted = false // mis-scoped assignment grants nothing
    if (granted) perms.forEach((p) => anywhere.add(p))
  }

  const ccgOfCcf = new Map(hierarchy.ccfs.map((c) => [c.id, c.ccgId]))
  const councilOfCcg = new Map(hierarchy.ccgs.map((g) => [g.id, g.councilId]))
  const streamOfCouncil = new Map((hierarchy.councils ?? []).map((c) => [c.id, c.streamId]))

  const campusOfStream = new Map((hierarchy.streams ?? []).map((s) => [s.id, s.campusId]))

  const canOnCampus = (perm: Permission, campusId: string | null | undefined) => global.has(perm) || (!!campusId && !!byCampus.get(campusId)?.has(perm))

  const canOnStream = (perm: Permission, streamId: string | null | undefined) =>
    global.has(perm) || (!!streamId && (!!byStream.get(streamId)?.has(perm) || canOnCampus(perm, campusOfStream.get(streamId) ?? null)))

  const canOnCouncil = (perm: Permission, councilId: string | null | undefined) =>
    global.has(perm) ||
    (!!councilId && (!!byCouncil.get(councilId)?.has(perm) || canOnStream(perm, streamOfCouncil.get(councilId) ?? null)))

  const canOnCcg = (perm: Permission, ccgId: string | null | undefined) =>
    global.has(perm) ||
    (!!ccgId && (!!byCcg.get(ccgId)?.has(perm) || canOnCouncil(perm, councilOfCcg.get(ccgId) ?? null)))

  const canOnCcf = (perm: Permission, ccfId: string | null | undefined) =>
    global.has(perm) ||
    (!!ccfId && (!!byCcf.get(ccfId)?.has(perm) || canOnCcg(perm, ccgOfCcf.get(ccfId) ?? null)))

  // Sheep Seekers act on the converts in their sheep seeking groups with their role's permissions, whatever CCF those converts are in.
  const seekerPerms = new Set(assignments.filter((a) => a.roleKey === 'sheep_seeker').flatMap((a) => a.permissions.filter(isPermission)))
  const seekingGroupIds = seekerPerms.size ? [...new Set(self.seekingGroupIds ?? [])] : []

  // Members are reached through leadership roles only (not sheep seeking ones).
  const leading = assignments.filter((a) => !SEEKING_ROLES.includes(a.roleKey))
  const leaders = leading.length === assignments.length ? null : resolveCcgScope(leading, hierarchy)
  const ccfIds = (perm: Permission): IdSet => (global.has(perm) ? 'all' : hierarchy.ccfs.filter((c) => canOnCcf(perm, c.id)).map((c) => c.id))

  const scope: CcgScope = {
    roleKeys: [...new Set(assignments.map((a) => a.roleKey))],
    anywhere,
    can: (perm) => global.has(perm),
    canOnCcf,
    canOnCcg,
    canOnCouncil,
    canOnStream,
    canOnCampus,
    ccfIds,
    ccgIds: (perm) => (global.has(perm) ? 'all' : hierarchy.ccgs.filter((g) => canOnCcg(perm, g.id)).map((g) => g.id)),
    councilIds: (perm) =>
      global.has(perm) ? 'all' : (hierarchy.councils ?? []).filter((c) => canOnCouncil(perm, c.id)).map((c) => c.id),
    streamIds: (perm) =>
      global.has(perm)
        ? 'all'
        : [
            ...new Set([
              ...[...byStream].filter(([, ps]) => ps.has(perm)).map(([id]) => id),
              ...(hierarchy.streams ?? []).filter((s) => canOnCampus(perm, s.campusId)).map((s) => s.id),
            ]),
          ],
    seekingGroupIds,
    canOnSeekingGroup: (perm, groupId) => !!groupId && seekingGroupIds.includes(groupId) && seekerPerms.has(perm),
    canOnMembersOf: (perm, ccfId) => (leaders ? leaders.canOnCcf(perm, ccfId) : canOnCcf(perm, ccfId)),
    memberCcfIds: (perm) => (leaders ? leaders.ccfIds(perm) : ccfIds(perm)),
    leadership: () => leaders ?? scope,
  }
  return scope
}

/** Prisma `in` filter for an IdSet (undefined = no restriction). */
export function inFilter(ids: IdSet): { in: string[] } | undefined {
  return ids === 'all' ? undefined : { in: ids }
}
