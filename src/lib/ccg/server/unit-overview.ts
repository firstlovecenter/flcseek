import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere } from '../access'
import { notFound } from '../errors'
import type { CcgScope } from '../scope'
import { dateOnly, iso, userDisplayName, userRefs } from './common'
import { ensure } from './handler'

/**
 * One unit's page (stream, council, CCG or CCF), in the shape of the admin
 * portal's church details page: breadcrumb, leader, stat tiles, sub-units and
 * history.
 */

export const UNIT_TYPES = ['campus', 'stream', 'council', 'ccg', 'ccf'] as const
export type UnitType = (typeof UNIT_TYPES)[number]

export const isUnitType = (v: unknown): v is UnitType => typeof v === 'string' && (UNIT_TYPES as readonly string[]).includes(v)

/** The role that leads each level (a stream: its Sheep Seeking Overseer). */
const LEADER_ROLE: Record<UnitType, string> = {
  campus: 'campus_leader',
  stream: 'seeking_overseer',
  council: 'overseer',
  ccg: 'ccg_governor',
  ccf: 'ccf_coordinator',
}

/** CCFs inside a unit (live ones only). */
export async function ccfIdsIn(type: UnitType, id: string): Promise<string[]> {
  const where: Prisma.CcgFamilyWhereInput =
    type === 'ccf'
      ? { id }
      : type === 'ccg'
        ? { ccgId: id }
        : type === 'council'
          ? { ccg: { councilId: id, deletedAt: null } }
          : type === 'stream'
            ? { ccg: { deletedAt: null, council: { streamId: id, deletedAt: null } } }
            : { ccg: { deletedAt: null, council: { deletedAt: null, stream: { campusId: id, deletedAt: null } } } }
  const rows = await prisma.ccgFamily.findMany({ where: { ...where, deletedAt: null }, select: { id: true } })
  return rows.map((r) => r.id)
}

/** Group pages belong to City Church Groups: sheep seeking roles don't count here. */
export function canSeeUnit(full: CcgScope, type: UnitType, id: string) {
  const scope = full.leadership()
  return type === 'ccf'
    ? scope.canOnCcf('people.view', id)
    : type === 'ccg'
      ? scope.canOnCcg('people.view', id)
      : type === 'council'
        ? scope.canOnCouncil('people.view', id)
        : type === 'stream'
          ? scope.canOnStream('people.view', id)
          : scope.canOnCampus('people.view', id)
}

type Crumb = { type: UnitType; id: string; name: string }

async function loadUnit(type: UnitType, id: string) {
  if (type === 'ccf') {
    const f = await prisma.ccgFamily.findFirst({
      where: { id, deletedAt: null },
      include: { ccg: { include: { council: { include: { stream: { include: { campus: true } } } } } } },
    })
    if (!f) throw notFound('CCF')
    const c = f.ccg.council
    const crumbs: Crumb[] = [
      ...(c?.stream?.campus ? [{ type: 'campus' as const, id: c.stream.campus.id, name: c.stream.campus.name }] : []),
      ...(c?.stream ? [{ type: 'stream' as const, id: c.stream.id, name: c.stream.name }] : []),
      ...(c ? [{ type: 'council' as const, id: c.id, name: c.name }] : []),
      { type: 'ccg', id: f.ccg.id, name: f.ccg.name },
    ]
    return {
      unit: {
        type,
        id: f.id,
        code: f.code,
        name: f.name,
        status: f.status,
        capacity: f.capacity,
        meeting_day: f.meetingDay,
        meeting_time: f.meetingTime,
        meeting_location: f.meetingLocation,
        audience: f.ccg.audience,
        notes: f.notes,
        created_at: iso(f.createdAt),
      },
      crumbs,
    }
  }
  if (type === 'ccg') {
    const g = await prisma.ccgGroup.findFirst({ where: { id, deletedAt: null }, include: { council: { include: { stream: { include: { campus: true } } } } } })
    if (!g) throw notFound('CCG')
    const c = g.council
    return {
      unit: {
        type,
        id: g.id,
        code: g.code,
        name: g.name,
        status: g.status,
        audience: g.audience,
        notes: g.notes,
        created_at: iso(g.createdAt),
      },
      crumbs: [
        ...(c?.stream?.campus ? [{ type: 'campus' as const, id: c.stream.campus.id, name: c.stream.campus.name }] : []),
        ...(c?.stream ? [{ type: 'stream' as const, id: c.stream.id, name: c.stream.name }] : []),
        ...(c ? [{ type: 'council' as const, id: c.id, name: c.name }] : []),
      ],
    }
  }
  if (type === 'council') {
    const c = await prisma.ccgCouncil.findFirst({ where: { id, deletedAt: null }, include: { stream: { include: { campus: true } } } })
    if (!c) throw notFound('Council')
    return {
      unit: { type, id: c.id, code: c.code, name: c.name, status: c.status, notes: c.notes, created_at: iso(c.createdAt) },
      crumbs: [
        ...(c.stream?.campus ? [{ type: 'campus' as const, id: c.stream.campus.id, name: c.stream.campus.name }] : []),
        ...(c.stream ? [{ type: 'stream' as const, id: c.stream.id, name: c.stream.name }] : []),
      ],
    }
  }
  if (type === 'stream') {
    const s = await prisma.ccgStream.findFirst({ where: { id, deletedAt: null }, include: { campus: true } })
    if (!s) throw notFound('Stream')
    return {
      unit: { type, id: s.id, code: s.code, name: s.name, status: s.status, notes: s.notes, campus_id: s.campusId, created_at: iso(s.createdAt) },
      crumbs: s.campus ? [{ type: 'campus' as const, id: s.campus.id, name: s.campus.name }] : ([] as Crumb[]),
    }
  }
  const cp = await prisma.ccgCampus.findFirst({ where: { id, deletedAt: null } })
  if (!cp) throw notFound('Campus')
  return { unit: { type, id: cp.id, code: cp.code, name: cp.name, status: cp.status, notes: cp.notes, created_at: iso(cp.createdAt) }, crumbs: [] as Crumb[] }
}

/** Leader names (from their member record) for a set of groups of one level. */
async function leaderNames(type: UnitType, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const field = type === 'campus' ? 'campusId' : type === 'stream' ? 'streamId' : type === 'council' ? 'councilId' : type === 'ccg' ? 'ccgId' : 'ccfId'
  const rows = await prisma.ccgRoleAssignment.findMany({
    where: { roleKey: LEADER_ROLE[type], [field]: { in: ids }, ...currentAssignmentWhere() },
    select: {
      campusId: true,
      streamId: true,
      councilId: true,
      ccgId: true,
      ccfId: true,
      user: { select: { username: true, firstName: true, lastName: true, ccgPeople: { where: { deletedAt: null }, select: { fullName: true }, take: 1 } } },
    },
  })
  const out = new Map<string, string>()
  for (const r of rows) {
    const unit = r.campusId ?? r.streamId ?? r.councilId ?? r.ccgId ?? r.ccfId
    if (unit && !out.has(unit)) out.set(unit, r.user.ccgPeople[0]?.fullName ?? userDisplayName(r.user))
  }
  return out
}

/** Sub-groups with their leader and member and placed-convert counts. */
export async function childGroups(type: UnitType, id: string) {
  const c = await children(type, id)
  if (!c) return null
  const leaders = await leaderNames(c.type, c.items.map((i) => i.id))
  return { type: c.type, items: c.items.map((i) => ({ ...i, leader: leaders.get(i.id) ?? null })) }
}

/**
 * The top of the tree (church-wide focus), newest first: campuses and any
 * streams with no campus; just streams while no campus exists.
 */
export async function topGroups(full: CcgScope) {
  const scope = full.leadership()
  const [campuses, streams] = await Promise.all([
    prisma.ccgCampus.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.ccgStream.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } }),
  ])
  const visibleCampuses = campuses.filter((c) => scope.canOnCampus('people.view', c.id))
  const visibleStreams = streams.filter((s) => (!s.campusId || !visibleCampuses.some((c) => c.id === s.campusId)) && scope.canOnStream('people.view', s.id))
  const [campusLeaders, streamLeaders] = await Promise.all([
    leaderNames('campus', visibleCampuses.map((c) => c.id)),
    leaderNames('stream', visibleStreams.map((s) => s.id)),
  ])
  const counts = async (type: 'campus' | 'stream', id: string) => {
    const ccfIds = await ccfIdsIn(type, id)
    const [members, placed] = await Promise.all([
      prisma.ccgPerson.count({ where: { kind: 'member', status: 'active', deletedAt: null, ccfId: { in: ccfIds } } }),
      prisma.ccgPlacement.count({ where: { status: 'active', finalCcfId: { in: ccfIds }, person: { deletedAt: null } } }),
    ])
    return { members, placed }
  }
  const items = await Promise.all([
    ...visibleCampuses.map(async (c) => ({
      type: 'campus' as const,
      id: c.id,
      code: c.code,
      name: c.name,
      status: c.status,
      ...(await counts('campus', c.id)),
      leader: campusLeaders.get(c.id) ?? null,
    })),
    ...visibleStreams.map(async (s) => ({
      type: 'stream' as const,
      id: s.id,
      code: s.code,
      name: s.name,
      status: s.status,
      ...(await counts('stream', s.id)),
      leader: streamLeaders.get(s.id) ?? null,
    })),
  ])
  return { type: campuses.length ? ('campus' as const) : ('stream' as const), items }
}

/** Sub-units with their member and placed-convert counts. */
async function children(type: UnitType, id: string) {
  const count = async (ccfIds: string[]) => {
    const [members, placed] = await Promise.all([
      prisma.ccgPerson.count({ where: { kind: 'member', status: 'active', deletedAt: null, ccfId: { in: ccfIds } } }),
      prisma.ccgPlacement.count({ where: { status: 'active', finalCcfId: { in: ccfIds }, person: { deletedAt: null } } }),
    ])
    return { members, placed }
  }
  if (type === 'ccg') {
    const rows = await prisma.ccgFamily.findMany({ where: { ccgId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } })
    return {
      type: 'ccf' as const,
      items: await Promise.all(rows.map(async (r) => ({ id: r.id, code: r.code, name: r.name, status: r.status, ...(await count([r.id])) }))),
    }
  }
  if (type === 'council') {
    const rows = await prisma.ccgGroup.findMany({ where: { councilId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } })
    return {
      type: 'ccg' as const,
      items: await Promise.all(
        rows.map(async (r) => ({ id: r.id, code: r.code, name: r.name, status: r.status, ...(await count(await ccfIdsIn('ccg', r.id))) }))
      ),
    }
  }
  if (type === 'campus') {
    const rows = await prisma.ccgStream.findMany({ where: { campusId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } })
    return {
      type: 'stream' as const,
      items: await Promise.all(
        rows.map(async (r) => ({ id: r.id, code: r.code, name: r.name, status: r.status, ...(await count(await ccfIdsIn('stream', r.id))) }))
      ),
    }
  }
  if (type === 'stream') {
    const rows = await prisma.ccgCouncil.findMany({ where: { streamId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } })
    return {
      type: 'council' as const,
      items: await Promise.all(
        rows.map(async (r) => ({ id: r.id, code: r.code, name: r.name, status: r.status, ...(await count(await ccfIdsIn('council', r.id))) }))
      ),
    }
  }
  return null
}

/** Role holders at this unit; each is a member (every role is held by a member). */
async function holders(type: UnitType, id: string) {
  const field = type === 'campus' ? 'campusId' : type === 'stream' ? 'streamId' : type === 'council' ? 'councilId' : type === 'ccg' ? 'ccgId' : 'ccfId'
  const rows = await prisma.ccgRoleAssignment.findMany({
    where: { [field]: id, ...currentAssignmentWhere() },
    include: {
      role: true,
      user: {
        select: {
          username: true,
          firstName: true,
          lastName: true,
          ccgPeople: { where: { kind: 'member', deletedAt: null }, select: { id: true, fullName: true, firstName: true, lastName: true }, take: 1 },
        },
      },
    },
    orderBy: { role: { sortOrder: 'asc' } },
  })
  return rows.map((a) => {
    const person = a.user.ccgPeople[0]
    return {
      assignment_id: a.id,
      role_key: a.roleKey,
      role: a.role.name,
      user_id: a.userId,
      person_id: person?.id ?? null,
      name: person?.fullName ?? userDisplayName(a.user),
      initials: `${person?.firstName?.[0] ?? a.user.firstName?.[0] ?? ''}${person?.lastName?.[0] ?? a.user.lastName?.[0] ?? ''}`.toUpperCase(),
      since: dateOnly(a.startsOn),
    }
  })
}

// ---------------------------------------------------------------------------
// History: the audit trail for this unit, in plain sentences
// ---------------------------------------------------------------------------

type LogRow = Prisma.CcgActivityLogGetPayload<object>
const val = (r: LogRow, key: string) => (r.newValues as Record<string, unknown> | null)?.[key]

function sentence(r: LogRow, names: { people: Map<string, string>; units: Map<string, string>; roles: Map<string, string> }): string | null {
  const person = r.entityType === 'ccg_person' && r.entityId ? names.people.get(r.entityId) ?? 'Someone' : 'Someone'
  const unit = (id: unknown) => (typeof id === 'string' ? names.units.get(id) ?? 'another unit' : 'another unit')
  switch (r.action) {
    case 'CCF_CREATED':
    case 'CCG_CREATED':
    case 'COUNCIL_CREATED':
    case 'STREAM_CREATED':
      return 'Created'
    case 'CCF_UPDATED':
    case 'CCG_UPDATED':
    case 'COUNCIL_UPDATED':
    case 'STREAM_UPDATED':
      return 'Details updated'
    case 'CCF_DELETED':
    case 'CCG_DELETED':
    case 'COUNCIL_DELETED':
    case 'STREAM_DELETED':
      return 'Closed down'
    case 'ROLE_ASSIGNED': {
      const holder = typeof val(r, 'user_id') === 'string' ? names.people.get(val(r, 'user_id') as string) : null
      return `${holder ?? 'A member'} became ${names.roles.get(String(val(r, 'role'))) ?? 'a leader'}`
    }
    case 'ROLE_UNASSIGNED':
      return 'A role came to an end'
    case 'PLACEMENT_APPROVED':
      return 'A new convert was placed here'
    case 'PLACEMENT_REMAPPED':
      return 'A new convert was placed here by the central team'
    case 'MEMBER_REGISTERED':
      return `${person} registered as a member`
    case 'MEMBER_CONFIRMED':
      return `${person} was confirmed as a member`
    case 'CONVERT_GRADUATED':
      return `${person} completed their assessment year and became a member`
    case 'CONVERT_BECAME_MEMBER':
      return `${person} became a member`
    case 'MEMBER_TRANSFERRED':
    case 'CONVERT_TRANSFERRED':
      return `${person} transferred ${
        (r.oldValues as Record<string, unknown> | null)?.ccf_id ? `from ${unit((r.oldValues as Record<string, unknown>).ccf_id)} ` : ''
      }to ${unit(val(r, 'ccf_id'))}`
    case 'ATTENDANCE_MARKED':
      return `Attendance marked: ${val(r, 'present') ?? 0} present at ${String(val(r, 'event_type') ?? '').replace(/_/g, ' ')} on ${val(r, 'event_date') ?? ''}`
    case 'GROUP_ACTIVITY_RECORDED':
      return val(r, 'type') === 'intercession'
        ? `Wednesday intercession held${val(r, 'prayed_for') ? `, ${val(r, 'prayed_for')} converts prayed for by name` : ''}`
        : 'Fellowship over food held'
    default:
      return null
  }
}

async function history(type: UnitType, id: string, limit = 5) {
  const unitKey = type === 'ccf' ? 'ccf' : type === 'ccg' ? 'ccg' : type === 'council' ? 'council' : type === 'stream' ? 'stream' : 'campus'
  const where: Prisma.CcgActivityLogWhereInput = {
    OR: [
      { entityId: id },
      { entityType: 'ccg_role_assignment', newValues: { path: [unitKey], equals: id } },
      ...(type === 'ccf'
        ? [
            { entityType: 'ccg_person', newValues: { path: ['ccf_id'], equals: id } },
            { entityType: 'ccg_person', oldValues: { path: ['ccf_id'], equals: id } },
            { entityType: 'ccg_placement', action: { in: ['PLACEMENT_APPROVED', 'PLACEMENT_REMAPPED'] }, newValues: { path: ['ccf_id'], equals: id } },
          ]
        : []),
    ],
  }
  const rows = await prisma.ccgActivityLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 60 })

  const personIds = rows.filter((r) => r.entityType === 'ccg_person' && r.entityId).map((r) => r.entityId!)
  const holderUserIds = rows.map((r) => val(r, 'user_id')).filter((x): x is string => typeof x === 'string')
  const unitIds = rows
    .flatMap((r) => [val(r, 'ccf_id'), (r.oldValues as Record<string, unknown> | null)?.ccf_id])
    .filter((x): x is string => typeof x === 'string')
  const roleKeys = rows.map((r) => val(r, 'role')).filter((x): x is string => typeof x === 'string')
  const [people, holdersByUser, ccfs, roles, actors] = await Promise.all([
    prisma.ccgPerson.findMany({ where: { id: { in: personIds } }, select: { id: true, fullName: true } }),
    prisma.ccgPerson.findMany({ where: { userId: { in: holderUserIds }, deletedAt: null }, select: { userId: true, fullName: true } }),
    prisma.ccgFamily.findMany({ where: { id: { in: unitIds } }, select: { id: true, name: true } }),
    prisma.ccgRole.findMany({ where: { key: { in: roleKeys } }, select: { key: true, name: true } }),
    userRefs(rows.map((r) => r.userId)),
  ])
  const names = {
    people: new Map([...people.map((p) => [p.id, p.fullName] as const), ...holdersByUser.map((p) => [p.userId!, p.fullName] as const)]),
    units: new Map(ccfs.map((f) => [f.id, f.name])),
    roles: new Map(roles.map((r) => [r.key, r.name])),
  }
  return rows
    .map((r) => {
      const text = sentence(r, names)
      return text ? { id: r.id, text, at: iso(r.createdAt), by: r.userId ? actors.get(r.userId)?.name ?? null : null } : null
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------

export async function unitOverview(scope: CcgScope, type: UnitType, id: string, historyLimit = 5) {
  ensure(canSeeUnit(scope, type, id), 'You can only view units in your scope')
  const { unit, crumbs } = await loadUnit(type, id)
  const ccfIds = await ccfIdsIn(type, id)
  const within = { in: ccfIds }
  const today = new Date()

  const [members, pending, placed, proposals, graduated, roleHolders, subs, log, overdueRows] = await Promise.all([
    prisma.ccgPerson.count({ where: { kind: 'member', status: 'active', deletedAt: null, ccfId: within } }),
    prisma.ccgPerson.count({ where: { kind: 'member', status: 'pending', deletedAt: null, ccfId: within } }),
    prisma.ccgPlacement.count({ where: { status: 'active', finalCcfId: within, person: { deletedAt: null } } }),
    prisma.ccgPlacement.count({ where: { status: 'proposed', proposedCcfId: within, person: { deletedAt: null } } }),
    prisma.ccgPlacement.count({ where: { outcome: 'graduated', finalCcfId: within } }),
    holders(type, id),
    childGroups(type, id),
    history(type, id, historyLimit),
    prisma.ccgPlacement.findMany({
      where: { status: 'active', finalCcfId: within, person: { deletedAt: null } },
      select: { decidedAt: true, createdAt: true, progressRecords: { where: { isCompleted: true }, select: { stageNumber: true } } },
    }),
  ])
  const milestones = await prisma.ccgMilestone.findMany({ where: { isActive: true }, select: { stageNumber: true, targetDays: true } })
  let overdue = 0
  for (const p of overdueRows) {
    const start = (p.decidedAt ?? p.createdAt ?? today).getTime()
    const done = new Set(p.progressRecords.map((r) => r.stageNumber))
    for (const m of milestones) if (!done.has(m.stageNumber) && m.targetDays !== null && start + m.targetDays * 86_400_000 < today.getTime()) overdue++
  }

  const leaderKey = LEADER_ROLE[type]
  const capacity = 'capacity' in unit ? (unit.capacity as number) : null
  return {
    unit,
    breadcrumb: crumbs,
    leaders: roleHolders.filter((h) => h.role_key === leaderKey),
    role_holders: roleHolders,
    stats: {
      members,
      pending_members: pending,
      placed_converts: placed,
      awaiting_approval: proposals,
      graduated,
      milestones_overdue: overdue,
      open_places: capacity !== null ? Math.max(0, capacity - members - placed) : null,
      ccf_count: type === 'ccf' ? null : ccfIds.length,
    },
    children: subs,
    history: log,
  }
}
