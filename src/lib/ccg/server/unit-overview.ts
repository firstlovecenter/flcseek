import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere } from '../access'
import { notFound } from '../errors'
import type { CcgScope } from '../scope'
import { dateOnly, iso, userDisplayName, userRefs } from './common'
import { formatTime12h } from '../engine/meeting-slot'
import { ensure } from './handler'

/**
 * One unit's page (campus, stream, CCG or CCF), in the shape of the admin
 * portal's church details page: breadcrumb, leader, stat tiles, sub-units and
 * history.
 */

export const UNIT_TYPES = ['campus', 'stream', 'ccg', 'ccf'] as const
export type UnitType = (typeof UNIT_TYPES)[number]

export const isUnitType = (v: unknown): v is UnitType => typeof v === 'string' && (UNIT_TYPES as readonly string[]).includes(v)

/** The role that leads each level on the City Church Groups side. */
const LEADER_ROLE: Record<UnitType, string> = {
  campus: 'campus_leader',
  stream: 'overseer',
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
        : type === 'stream'
          ? { ccg: { deletedAt: null, streamId: id } }
          : { ccg: { deletedAt: null, stream: { campusId: id, deletedAt: null } } }
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
      : type === 'stream'
        ? scope.canOnStream('people.view', id)
        : scope.canOnCampus('people.view', id)
}

type Crumb = { type: UnitType; id: string; name: string }

async function loadUnit(type: UnitType, id: string) {
  if (type === 'ccf') {
    const f = await prisma.ccgFamily.findFirst({
      where: { id, deletedAt: null },
      include: { ccg: { include: { stream: { include: { campus: true } } } } },
    })
    if (!f) throw notFound('CCF')
    const s = f.ccg.stream
    const crumbs: Crumb[] = [
      ...(s.campus ? [{ type: 'campus' as const, id: s.campus.id, name: s.campus.name }] : []),
      { type: 'stream', id: s.id, name: s.name },
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
        notes: f.notes,
        created_at: iso(f.createdAt),
      },
      crumbs,
    }
  }
  if (type === 'ccg') {
    const g = await prisma.ccgGroup.findFirst({ where: { id, deletedAt: null }, include: { stream: { include: { campus: true } } } })
    if (!g) throw notFound('CCG')
    const s = g.stream
    return {
      unit: {
        type,
        id: g.id,
        code: g.code,
        name: g.name,
        status: g.status,
        notes: g.notes,
        created_at: iso(g.createdAt),
      },
      crumbs: [
        ...(s.campus ? [{ type: 'campus' as const, id: s.campus.id, name: s.campus.name }] : []),
        { type: 'stream' as const, id: s.id, name: s.name },
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
  const field = type === 'campus' ? 'campusId' : type === 'stream' ? 'streamId' : type === 'ccg' ? 'ccgId' : 'ccfId'
  const rows = await prisma.ccgRoleAssignment.findMany({
    where: { roleKey: LEADER_ROLE[type], [field]: { in: ids }, ...currentAssignmentWhere() },
    select: {
      campusId: true,
      streamId: true,
      ccgId: true,
      ccfId: true,
      user: { select: { username: true, firstName: true, lastName: true, ccgPeople: { where: { deletedAt: null }, select: { fullName: true }, take: 1 } } },
    },
  })
  const out = new Map<string, string>()
  for (const r of rows) {
    const unit = r.campusId ?? r.streamId ?? r.ccgId ?? r.ccfId
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
  if (type === 'stream') {
    const rows = await prisma.ccgGroup.findMany({ where: { streamId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } })
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
  return null
}

/** Role holders at this unit; each is a member (every role is held by a member). */
async function holders(type: UnitType, id: string) {
  const field = type === 'campus' ? 'campusId' : type === 'stream' ? 'streamId' : type === 'ccg' ? 'ccgId' : 'ccfId'
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
type Values = Record<string, unknown>
const vals = (v: unknown): Values => (v && typeof v === 'object' ? (v as Values) : {})
const val = (r: LogRow, key: string) => vals(r.newValues)[key]
const str = (x: unknown) => (typeof x === 'string' ? x : null)

const LEVEL_WORD = { campus: 'Campus', stream: 'Stream', ccg: 'CCG', ccf: 'CCF' } as const
type Level = keyof typeof LEVEL_WORD
/** Words a role's name may start with that repeat its level ("Campus Leader", "City Church Family Coordinator"). */
const LEVEL_PREFIXES: Record<Level, string[]> = {
  campus: ['Campus'],
  stream: ['Stream'],
  ccg: ['City Church', 'CCG'],
  ccf: ['City Church Family', 'CCF'],
}

/** "Revival Campus", "Online with Edward CCF" (the level is not repeated if the name ends with it). */
function unitLabel(name: string, level: Level): string {
  const word = LEVEL_WORD[level]
  return name.toLowerCase().endsWith(` ${word.toLowerCase()}`) ? name : `${name} ${word}`
}

/**
 * The position, where it is held: "Revival Campus Sheep Seeking Admin",
 * "Online with Edward CCF Coordinator". Church-wide roles are just the role.
 */
function position(where: Values, role: string, units: Map<string, string>): string {
  for (const level of ['ccf', 'ccg', 'stream', 'campus'] as Level[]) {
    const id = str(where[level])
    if (!id) continue
    const name = units.get(id)
    if (!name) return role
    const prefix = LEVEL_PREFIXES[level].find((p) => role.toLowerCase().startsWith(`${p.toLowerCase()} `))
    return `${unitLabel(name, level)} ${prefix ? role.slice(prefix.length + 1) : role}`
  }
  return role
}

/** "A, B and C" */
const listOf = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)
const capitalise = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

/** A logged value in comparable form (a stored time and "19:00" compare equal). */
function plain(x: unknown): string | null {
  if (x === null || x === undefined || x === '') return null
  const s = String(x)
  const time = /^1970-01-01T(\d\d:\d\d)/.exec(s) ?? /^(\d\d:\d\d)(:\d\d)?$/.exec(s)
  return time ? time[1] : s
}

const UNIT_FIELDS: Record<string, string> = {
  name: 'name',
  meeting_location: 'meeting place',
  meeting_day: 'meeting day',
  meeting_time: 'meeting time',
  meeting_frequency: 'meeting frequency',
  capacity: 'capacity',
}

/** What an edit changed, e.g. "Meeting day changed from Tuesday to Thursday; capacity changed from 12 to 15". */
function unitChanges(r: LogRow, units: Map<string, string>): string | null {
  const before = vals(r.oldValues)
  const after = vals(r.newValues)
  const parts: string[] = []
  for (const [key, value] of Object.entries(after)) {
    const was = plain(before[toCamel(key)])
    const now = plain(value)
    if (was === now) continue
    const show = (v: string) => (key === 'meeting_time' ? formatTime12h(v) : key === 'name' ? `"${v}"` : v)
    if (key in UNIT_FIELDS) {
      const label = UNIT_FIELDS[key]
      parts.push(
        now === null ? `${label} removed` : was === null ? `${label} set to ${show(now)}` : `${label} changed from ${show(was)} to ${show(now)}`
      )
    } else if (key === 'status' && now) {
      parts.push(now === 'active' ? 'made active' : now === 'inactive' ? 'made inactive' : `status changed to ${now}`)
    } else if (key === 'notes') {
      parts.push('notes updated')
    } else if (key === 'ccg_id' || key === 'stream_id' || key === 'campus_id') {
      const level = key.slice(0, -3) as Level
      parts.push(now ? `moved to ${unitLabel(units.get(now) ?? 'another', level)}` : `taken out of its ${LEVEL_WORD[level].toLowerCase()}`)
    }
    // code (never shown) and leader (recorded as role changes) are left out.
  }
  return parts.length ? capitalise(parts.join('; ')) : null
}

const PERSON_FIELDS: Record<string, string> = {
  first_name: 'name',
  middle_name: 'name',
  last_name: 'name',
  phone: 'phone',
  email: 'email',
  gender: 'gender',
  date_of_birth: 'date of birth',
  location: 'location',
  landmark: 'landmark',
  notes: 'notes',
  existing_connection_member_id: 'who they know in church',
  existing_connection_note: 'who they know in church',
  conversion_date: 'conversion date',
}

interface Names {
  people: Map<string, string>
  users: Map<string, string>
  units: Map<string, string>
  roles: Map<string, string>
  groups: Map<string, string>
  /** placement id → person id */
  placementPerson: Map<string, string>
  /** role assignment id → who held which role where (for older "ended" entries). */
  assignments: Map<string, Values>
}

function sentence(r: LogRow, names: Names): string | null {
  const personName = (id: string | null | undefined) => (id ? names.people.get(id) : undefined) ?? 'Someone'
  const person = r.entityType === 'ccg_person' ? personName(r.entityId) : 'Someone'
  const placed = r.entityType === 'ccg_placement' && r.entityId ? personName(names.placementPerson.get(r.entityId)) : 'A convert'
  const unit = (id: unknown) => (str(id) ? names.units.get(id as string) ?? 'another unit' : 'another unit')
  const reason = str(val(r, 'reason')) ? `: ${val(r, 'reason')}` : ''
  const group = `sheep seeking group "${(r.entityId && names.groups.get(r.entityId)) ?? str(val(r, 'name')) ?? 'a group'}"`
  const holding = (v: Values) => {
    const who = str(v.user_id) ? names.users.get(v.user_id as string) : undefined
    const role = names.roles.get(String(v.role))
    return { who: who ?? 'A member', what: role ? position(v, role, names.units) : 'a leader' }
  }
  switch (r.action) {
    case 'CAMPUS_CREATED':
    case 'STREAM_CREATED':
    case 'CCG_CREATED':
    case 'CCF_CREATED':
      return 'Created'
    case 'CAMPUS_UPDATED':
    case 'STREAM_UPDATED':
    case 'CCG_UPDATED':
    case 'CCF_UPDATED':
      return unitChanges(r, names.units)
    case 'CAMPUS_DELETED':
    case 'STREAM_DELETED':
    case 'CCG_DELETED':
    case 'CCF_DELETED':
      return 'Closed down'

    // "Samuel Cyrus-Aduteye became Revival Campus Sheep Seeking Admin"
    case 'ROLE_ASSIGNED': {
      const h = holding(vals(r.newValues))
      return `${h.who} became ${h.what}`
    }
    case 'ROLE_UNASSIGNED': {
      const v = str(val(r, 'role')) ? vals(r.newValues) : r.entityId ? names.assignments.get(r.entityId) : undefined
      if (!v) return 'A role came to an end'
      const h = holding(v)
      return `${h.who} is no longer ${h.what}`
    }

    case 'PLACEMENT_APPROVED':
      return `${placed} was placed here`
    case 'PLACEMENT_REMAPPED':
      return `${placed} was placed here instead of the proposed CCF${reason}`
    case 'PLACEMENT_HELD':
      return `${placed}'s placement here was put on hold${reason}`
    case 'PLACEMENT_ENDED':
      return `${placed}'s placement here ended${reason}${val(r, 'reopen') ? ' (sent back for matching)' : ''}`
    case 'CONVERT_INTEGRATED':
      return `${placed} was marked as integrated`

    case 'MEMBER_REGISTERED':
      return `${person} registered as a member`
    case 'MEMBER_CONFIRMED':
      return `${person} was confirmed as a member`
    case 'CONVERT_GRADUATED':
      return `${person} completed their assessment year and became a member`
    case 'CONVERT_BECAME_MEMBER':
      return `${person} became a member`
    case 'MEMBER_TRANSFERRED':
    case 'CONVERT_TRANSFERRED': {
      const from = vals(r.oldValues).ccf_id
      return `${person} transferred ${from ? `from ${unit(from)} ` : ''}to ${unit(val(r, 'ccf_id'))}`
    }
    case 'PERSON_REMOVED':
      return `${person} was removed`
    case 'PERSON_UPDATED': {
      const status = str(val(r, 'status'))
      if (status === 'inactive') return `${person} was made inactive`
      if (status === 'active') return `${person} was made active again`
      if (status === 'new') return `${person} was sent back for matching`
      const fields = Array.isArray(val(r, 'fields')) ? (val(r, 'fields') as string[]) : []
      const what = [...new Set(fields.map((f) => PERSON_FIELDS[f]).filter(Boolean))]
      if (Array.isArray(val(r, 'answers')) && (val(r, 'answers') as unknown[]).length) what.push('profile answers')
      return what.length ? `${person}'s details were updated: ${listOf(what)}` : null
    }

    case 'SEEKING_GROUP_CREATED':
      return `${capitalise(group)} was created`
    case 'SEEKING_GROUP_UPDATED': {
      const before = vals(r.oldValues)
      const after = vals(r.newValues)
      const parts: string[] = []
      if (str(after.name) && after.name !== before.name) parts.push(`renamed from "${before.name}" to "${after.name}"`)
      if (str(after.status) && after.status !== before.status) parts.push(after.status === 'active' ? 'reopened' : 'closed')
      if (after.notes !== undefined && plain(after.notes) !== plain(before.notes)) parts.push('notes updated')
      return parts.length ? `Sheep seeking group "${str(before.name) ?? 'a group'}" was ${listOf(parts)}` : null
    }
    case 'SEEKING_GROUP_REMOVED':
      return `${capitalise(group)} was removed`
    case 'SEEKING_GROUP_SEEKER_ADDED':
      return `${names.users.get(String(val(r, 'user_id'))) ?? 'A Sheep Seeker'} joined ${group} as a Sheep Seeker`
    case 'SEEKING_GROUP_SEEKER_REMOVED':
      return `${names.users.get(String(val(r, 'user_id'))) ?? 'A Sheep Seeker'} left ${group}`
    case 'SEEKING_GROUP_CONVERTS_ADDED': {
      const added = Array.isArray(val(r, 'person_ids')) ? (val(r, 'person_ids') as string[]) : []
      const who = added.length && added.length <= 3 ? listOf(added.map(personName)) : `${added.length || 'Some'} converts`
      return `${who} ${added.length === 1 ? 'was' : 'were'} added to ${group}`
    }
    case 'SEEKING_GROUP_CONVERT_REMOVED':
      return `${personName(str(val(r, 'person_id')))} was taken out of ${group}`

    case 'ATTENDANCE_MARKED':
      return `Attendance marked: ${val(r, 'present') ?? 0} present at ${String(val(r, 'event_type') ?? '').replace(/_/g, ' ')} on ${val(r, 'event_date') ?? ''}`
    case 'GROUP_ACTIVITY_RECORDED':
      return val(r, 'type') === 'intercession'
        ? `Intercession held${val(r, 'prayed_for') ? `, ${val(r, 'prayed_for')} converts prayed for by name` : ''}`
        : val(r, 'type') === 'fellowship_service'
          ? 'Fellowship service held'
          : 'Fellowship over food held'
    default:
      return null
  }
}

const unitField = { campus: 'campusId', stream: 'streamId', ccg: 'ccgId', ccf: 'ccfId' } as const

/**
 * The unit's history, newest first: its own edits, roles given and ended
 * there, and (for a CCF) its members' and converts' changes, (for a stream)
 * its sheep seeking groups'.
 */
async function history(type: UnitType, id: string, limit = 5) {
  const [assignments, given, placements, members, groups] = await Promise.all([
    prisma.ccgRoleAssignment.findMany({ where: { [unitField[type]]: id }, select: { id: true } }),
    // Roles given here, as logged: older "role ended" entries are matched to them by assignment.
    prisma.ccgActivityLog.findMany({
      where: { action: 'ROLE_ASSIGNED', entityType: 'ccg_role_assignment', newValues: { path: [type], equals: id } },
      select: { entityId: true, newValues: true },
    }),
    type === 'ccf'
      ? prisma.ccgPlacement.findMany({
          where: { OR: [{ finalCcfId: id }, { proposedCcfId: id }] },
          select: { id: true, personId: true, finalCcfId: true, proposedCcfId: true },
        })
      : Promise.resolve([] as Array<{ id: string; personId: string; finalCcfId: string | null; proposedCcfId: string | null }>),
    type === 'ccf' ? prisma.ccgPerson.findMany({ where: { ccfId: id }, select: { id: true } }) : Promise.resolve([] as Array<{ id: string }>),
    type === 'stream'
      ? prisma.ccgSeekingGroup.findMany({ where: { streamId: id }, select: { id: true, name: true } })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
  ])
  const placedHere = placements.filter((p) => p.finalCcfId === id)
  const personIdsHere = [...members.map((m) => m.id), ...placedHere.map((p) => p.personId)]

  const where: Prisma.CcgActivityLogWhereInput = {
    OR: [
      { entityId: id },
      { entityType: 'ccg_role_assignment', newValues: { path: [type], equals: id } },
      {
        entityType: 'ccg_role_assignment',
        entityId: { in: [...new Set([...assignments.map((a) => a.id), ...given.map((g) => g.entityId).filter((x): x is string => !!x)])] },
      },
      ...(type === 'ccf'
        ? [
            { entityType: 'ccg_person', newValues: { path: ['ccf_id'], equals: id } },
            { entityType: 'ccg_person', oldValues: { path: ['ccf_id'], equals: id } },
            {
              entityType: 'ccg_person',
              entityId: { in: personIdsHere },
              action: { in: ['PERSON_UPDATED', 'PERSON_REMOVED', 'MEMBER_CONFIRMED', 'MEMBER_REGISTERED', 'CONVERT_GRADUATED', 'CONVERT_BECAME_MEMBER'] },
            },
            { entityType: 'ccg_placement', action: { in: ['PLACEMENT_APPROVED', 'PLACEMENT_REMAPPED'] }, newValues: { path: ['ccf_id'], equals: id } },
            { entityType: 'ccg_placement', action: { in: ['PLACEMENT_ENDED', 'CONVERT_INTEGRATED'] }, entityId: { in: placedHere.map((p) => p.id) } },
            {
              entityType: 'ccg_placement',
              action: 'PLACEMENT_HELD',
              entityId: { in: placements.filter((p) => p.proposedCcfId === id).map((p) => p.id) },
            },
          ]
        : []),
      ...(type === 'stream' ? [{ entityType: 'ccg_seeking_group', entityId: { in: groups.map((g) => g.id) } }] : []),
    ],
  }
  const rows = await prisma.ccgActivityLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.max(200, limit * 4) })

  // Older "role ended" entries only point at the assignment: take who, what and where
  // from the assignment, or (if it has since been deleted) from when it was given.
  const endedIds = rows.filter((r) => r.action === 'ROLE_UNASSIGNED' && !str(val(r, 'role')) && r.entityId).map((r) => r.entityId!)
  const ended = endedIds.length
    ? await prisma.ccgRoleAssignment.findMany({
        where: { id: { in: endedIds } },
        select: { id: true, userId: true, roleKey: true, campusId: true, streamId: true, ccgId: true, ccfId: true },
      })
    : []
  const assignmentValues = new Map<string, Values>([
    ...given.filter((g) => g.entityId).map((g) => [g.entityId!, vals(g.newValues)] as const),
    ...ended.map((a) => [a.id, { user_id: a.userId, role: a.roleKey, campus: a.campusId, stream: a.streamId, ccg: a.ccgId, ccf: a.ccfId }] as const),
  ])
  const all: Values[] = [...rows.map((r) => vals(r.newValues)), ...rows.map((r) => vals(r.oldValues)), ...assignmentValues.values()]
  const ids = (...keys: string[]) => [...new Set(all.flatMap((v) => keys.map((k) => str(v[k]))).filter((x): x is string => !!x))]
  const placementPerson = new Map(placements.map((p) => [p.id, p.personId]))
  const personIds = [
    ...rows.filter((r) => r.entityType === 'ccg_person' && r.entityId).map((r) => r.entityId!),
    ...placementPerson.values(),
    ...ids('person_id'),
    ...all.flatMap((v) => (Array.isArray(v.person_ids) ? (v.person_ids as string[]) : [])),
  ]
  const userIds = ids('user_id')
  const [people, usersAsMembers, users, ccfs, ccgs, streams, campuses, roles, actors] = await Promise.all([
    prisma.ccgPerson.findMany({ where: { id: { in: [...new Set(personIds)] } }, select: { id: true, fullName: true } }),
    prisma.ccgPerson.findMany({ where: { userId: { in: userIds }, deletedAt: null }, select: { userId: true, fullName: true } }),
    // Role holders linked by login only have no member profile: use their login's name.
    userRefs(userIds),
    prisma.ccgFamily.findMany({ where: { id: { in: ids('ccf_id', 'ccf') } }, select: { id: true, name: true } }),
    prisma.ccgGroup.findMany({ where: { id: { in: ids('ccg_id', 'ccg') } }, select: { id: true, name: true } }),
    prisma.ccgStream.findMany({ where: { id: { in: ids('stream_id', 'stream') } }, select: { id: true, name: true } }),
    prisma.ccgCampus.findMany({ where: { id: { in: ids('campus_id', 'campus') } }, select: { id: true, name: true } }),
    prisma.ccgRole.findMany({ where: { key: { in: ids('role') } }, select: { key: true, name: true } }),
    userRefs(rows.map((r) => r.userId)),
  ])
  const names: Names = {
    people: new Map(people.map((p) => [p.id, p.fullName])),
    users: new Map([...[...users.values()].map((u) => [u.id, u.name] as const), ...usersAsMembers.map((p) => [p.userId!, p.fullName] as const)]),
    units: new Map([...ccfs, ...ccgs, ...streams, ...campuses].map((u) => [u.id, u.name])),
    roles: new Map(roles.map((r) => [r.key, r.name])),
    groups: new Map(groups.map((g) => [g.id, g.name])),
    placementPerson,
    assignments: assignmentValues,
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
