import { isPermission, type Permission, type ScopeLevel } from './permissions'

/**
 * What a user may do, and where. Pure: the caller supplies the user's current
 * role assignments and the campus → stream → CCG → CCF hierarchy.
 *
 * A grant at a level covers everything beneath it: a campus grant covers its
 * streams; a stream grant (e.g. an Overseer's) covers its CCGs and their CCFs;
 * a Governor's CCG grant covers its CCFs.
 */

export interface AssignmentGrant {
  roleKey: string
  scopeLevel: ScopeLevel
  permissions: string[]
  campusId?: string | null
  streamId?: string | null
  ccgId: string | null
  ccfId: string | null
}

export interface Hierarchy {
  ccfs: Array<{ id: string; ccgId: string }>
  ccgs: Array<{ id: string; streamId: string | null }>
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
  canOnStream(perm: Permission, streamId: string | null | undefined): boolean
  canOnCampus(perm: Permission, campusId: string | null | undefined): boolean
  /**
   * Placing a convert into this CCF: `perm` on the CCF, or a sheep seeking role
   * on its stream (they place souls into the stream's CCFs without seeing inside them).
   */
  canPlaceInto(perm: Permission, ccfId: string | null | undefined): boolean
  /** `perm` on a campus's Sheep Seeking side (church-wide rights, or a campus Sheep Seeking role there). */
  canOnSeekingCampus(perm: Permission, campusId: string | null | undefined): boolean
  /** CCFs where `perm` applies. */
  ccfIds(perm: Permission): IdSet
  /** CCGs where `perm` applies (at CCG level or above). */
  ccgIds(perm: Permission): IdSet
  /** Streams where `perm` applies (at stream level or globally). */
  streamIds(perm: Permission): IdSet
  /** The sheep seeking groups this Sheep Seeker is assigned to: their converts are in reach wherever they are placed. */
  seekingGroupIds: string[]
  /** `perm` on a convert in one of this Sheep Seeker's groups (with the Sheep Seeker role's permissions). */
  canOnSeekingGroup(perm: Permission, groupId: string | null | undefined): boolean
  /**
   * `perm` on a CCF's members. Sheep seeking roles reach converts only, so
   * this counts CCF, CCG, Overseer and church-wide leadership roles alone.
   */
  canOnMembersOf(perm: Permission, ccfId: string | null | undefined): boolean
  /** CCFs whose members `perm` reaches (see canOnMembersOf). */
  memberCcfIds(perm: Permission): IdSet
  /** The same scope counting leadership roles only (City Church Groups side): group pages and structure. */
  leadership(): CcgScope
  /** The same scope counting the Sheep Seeking side only: seeking roles, plus campus and church-wide roles (which run both sides). */
  sheepSeeking(): CcgScope
}

/** Roles on the Sheep Seeking side: they work with converts, never with CCF members. */
export const SEEKING_ROLES: readonly string[] = ['sheep_seeker', 'seeking_admin', 'seeking_overseer', 'campus_seeking_admin', 'campus_seeking_overseer']

/**
 * The portal a role is given in: Sheep Seeking roles in the Sheep Seeking portal only; City Church
 * Groups roles there; church-wide roles and the Campus Leader (who see both sides) in either.
 */
export function roleInPortal(role: { key: string; scope_level: string }, portal: 'seeking' | 'ccg') {
  if (SEEKING_ROLES.includes(role.key)) return portal === 'seeking'
  if (role.scope_level === 'global' || role.key === 'campus_leader') return true
  return portal === 'ccg'
}

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
  // Sheep seeking roles hold their stream's converts, never its CCGs and CCFs (see canPlaceInto).
  const bySeekingStream: Grants = new Map()
  const bySeekingCampus: Grants = new Map()
  const byCcg: Grants = new Map()
  const byCcf: Grants = new Map()
  const anywhere = new Set<Permission>()

  for (const a of assignments) {
    const perms = a.permissions.filter(isPermission)
    let granted = true
    if (a.scopeLevel === 'global') perms.forEach((p) => global.add(p))
    else if (a.scopeLevel === 'campus' && a.campusId) add(SEEKING_ROLES.includes(a.roleKey) ? bySeekingCampus : byCampus, a.campusId, perms)
    else if (a.scopeLevel === 'stream' && a.streamId) add(SEEKING_ROLES.includes(a.roleKey) ? bySeekingStream : byStream, a.streamId, perms)
    else if (a.scopeLevel === 'ccg' && a.ccgId) add(byCcg, a.ccgId, perms)
    else if (a.scopeLevel === 'ccf' && a.ccfId) add(byCcf, a.ccfId, perms)
    else granted = false // mis-scoped assignment grants nothing
    if (granted) perms.forEach((p) => anywhere.add(p))
  }

  const ccgOfCcf = new Map(hierarchy.ccfs.map((c) => [c.id, c.ccgId]))
  const streamOfCcg = new Map(hierarchy.ccgs.map((g) => [g.id, g.streamId]))
  const campusOfStream = new Map((hierarchy.streams ?? []).map((s) => [s.id, s.campusId]))

  const canOnCampus = (perm: Permission, campusId: string | null | undefined) => global.has(perm) || (!!campusId && !!byCampus.get(campusId)?.has(perm))

  /** Leadership of the stream's CCGs (an Overseer's, a Campus Leader's, church-wide). */
  const leadsStream = (perm: Permission, streamId: string | null | undefined) =>
    global.has(perm) || (!!streamId && (!!byStream.get(streamId)?.has(perm) || canOnCampus(perm, campusOfStream.get(streamId) ?? null)))

  /** A sheep seeking role on the stream, or on its campus. */
  const seeksStream = (perm: Permission, streamId: string | null | undefined) =>
    !!streamId && (!!bySeekingStream.get(streamId)?.has(perm) || !!bySeekingCampus.get(campusOfStream.get(streamId) ?? '')?.has(perm))

  const canOnStream = (perm: Permission, streamId: string | null | undefined) => leadsStream(perm, streamId) || seeksStream(perm, streamId)

  const canOnCcg = (perm: Permission, ccgId: string | null | undefined) =>
    global.has(perm) ||
    (!!ccgId && (!!byCcg.get(ccgId)?.has(perm) || leadsStream(perm, streamOfCcg.get(ccgId) ?? null)))

  const canOnCcf = (perm: Permission, ccfId: string | null | undefined) =>
    global.has(perm) ||
    (!!ccfId && (!!byCcf.get(ccfId)?.has(perm) || canOnCcg(perm, ccgOfCcf.get(ccfId) ?? null)))

  // Sheep Seekers act on the converts in their sheep seeking groups with their role's permissions, whatever CCF those converts are in.
  const seekerPerms = new Set(assignments.filter((a) => a.roleKey === 'sheep_seeker').flatMap((a) => a.permissions.filter(isPermission)))
  const seekingGroupIds = seekerPerms.size ? [...new Set(self.seekingGroupIds ?? [])] : []

  // Members are reached through leadership roles only (not sheep seeking ones).
  const leading = assignments.filter((a) => !SEEKING_ROLES.includes(a.roleKey))
  const leaders = leading.length === assignments.length ? null : resolveCcgScope(leading, hierarchy)
  const seekingSide = assignments.filter((a) => SEEKING_ROLES.includes(a.roleKey) || a.scopeLevel === 'global' || a.scopeLevel === 'campus')
  let seekers: CcgScope | null = null
  const ccfIds = (perm: Permission): IdSet => (global.has(perm) ? 'all' : hierarchy.ccfs.filter((c) => canOnCcf(perm, c.id)).map((c) => c.id))

  const scope: CcgScope = {
    roleKeys: [...new Set(assignments.map((a) => a.roleKey))],
    anywhere,
    can: (perm) => global.has(perm),
    canOnCcf,
    canOnCcg,
    canOnStream,
    canOnCampus,
    canPlaceInto: (perm, ccfId) => {
      if (canOnCcf(perm, ccfId)) return true
      const stream = ccfId ? streamOfCcg.get(ccgOfCcf.get(ccfId) ?? '') : null
      return seeksStream(perm, stream)
    },
    canOnSeekingCampus: (perm, campusId) => global.has(perm) || (!!campusId && !!bySeekingCampus.get(campusId)?.has(perm)),
    ccfIds,
    ccgIds: (perm) => (global.has(perm) ? 'all' : hierarchy.ccgs.filter((g) => canOnCcg(perm, g.id)).map((g) => g.id)),
    streamIds: (perm) =>
      global.has(perm)
        ? 'all'
        : [
            ...new Set([
              ...[...byStream, ...bySeekingStream].filter(([, ps]) => ps.has(perm)).map(([id]) => id),
              ...(hierarchy.streams ?? [])
                .filter((s) => canOnCampus(perm, s.campusId) || !!bySeekingCampus.get(s.campusId ?? '')?.has(perm))
                .map((s) => s.id),
            ]),
          ],
    seekingGroupIds,
    canOnSeekingGroup: (perm, groupId) => !!groupId && seekingGroupIds.includes(groupId) && seekerPerms.has(perm),
    canOnMembersOf: (perm, ccfId) => (leaders ? leaders.canOnCcf(perm, ccfId) : canOnCcf(perm, ccfId)),
    memberCcfIds: (perm) => (leaders ? leaders.ccfIds(perm) : ccfIds(perm)),
    leadership: () => leaders ?? scope,
    sheepSeeking: () =>
      seekingSide.length === assignments.length ? scope : (seekers ??= resolveCcgScope(seekingSide, hierarchy, self)),
  }
  return scope
}

/** Prisma `in` filter for an IdSet (undefined = no restriction). */
export function inFilter(ids: IdSet): { in: string[] } | undefined {
  return ids === 'all' ? undefined : { in: ids }
}
