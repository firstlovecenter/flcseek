import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere, todayDate } from '../access'
import { conflict, invalid, notFound } from '../errors'
import type { ScopeLevel } from '../permissions'
import { ccgTx, dateOnly, iso, logCcg, userDisplayName, type Db } from './common'
import { personFor, type Appointee } from './appointee'
import { notifyRole, sendInvite, userForMember, type InviteResult } from './member-login'

export const assignmentInclude = {
  role: true,
  campus: { select: { id: true, code: true, name: true } },
  stream: { select: { id: true, code: true, name: true } },
  council: { select: { id: true, code: true, name: true } },
  user: { select: { id: true, username: true, firstName: true, lastName: true, role: true, deletedAt: true } },
  ccg: { select: { id: true, code: true, name: true } },
  ccf: { select: { id: true, code: true, name: true } },
} satisfies Prisma.CcgRoleAssignmentInclude

type AssignmentRow = Prisma.CcgRoleAssignmentGetPayload<{ include: typeof assignmentInclude }>

export function serializeAssignment(a: AssignmentRow) {
  const today = todayDate()
  const unit = a.campus
    ? { type: 'campus', ...a.campus }
    : a.stream
    ? { type: 'stream', ...a.stream }
    : a.council
    ? { type: 'council', ...a.council }
    : a.ccg
      ? { type: 'ccg', ...a.ccg }
      : a.ccf
        ? { type: 'ccf', ...a.ccf }
        : null
  return {
    id: a.id,
    user: { id: a.user.id, username: a.user.username, name: userDisplayName(a.user) },
    role: { key: a.role.key, name: a.role.name, scope_level: a.role.scopeLevel },
    unit,
    starts_on: dateOnly(a.startsOn),
    ends_on: dateOnly(a.endsOn),
    current: a.role.active && a.startsOn <= today && (!a.endsOn || a.endsOn > today),
    created_at: iso(a.createdAt),
  }
}

export function serializeRole(r: Prisma.CcgRoleGetPayload<object>, extra: { assignments?: number } = {}) {
  return {
    key: r.key,
    name: r.name,
    description: r.description,
    scope_level: r.scopeLevel,
    permissions: r.permissions,
    is_system: r.isSystem,
    active: r.active,
    sort_order: r.sortOrder,
    ...extra,
  }
}

/**
 * Refuse any change that would leave nobody able to manage roles (and so
 * nobody able to fix it). Seek superadmins always can. `mutate` runs inside
 * the transaction first.
 */
export async function withRolesManageKept<T>(mutate: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return ccgTx(async (tx) => {
    const out = await mutate(tx)
    const owners = await tx.ccgOwner.count({ where: { user: { deletedAt: null } } })
    if (owners > 0) return out
    const holders = await tx.ccgRoleAssignment.count({
      where: {
        ...currentAssignmentWhere(),
        role: { active: true, scopeLevel: 'global', permissions: { has: 'roles.manage' } },
        user: { deletedAt: null },
      },
    })
    if (holders === 0) throw conflict('This would leave nobody able to manage roles')
    return out
  })
}

export async function createAssignment(
  body: {
    user_id: string
    role_key: string
    campus_id?: string | null
    stream_id?: string | null
    council_id?: string | null
    ccg_id?: string | null
    ccf_id?: string | null
    starts_on?: string
  },
  actorId: string,
  db: Db = prisma,
  /** The CCG owner may give a Seek user a role on their Seek login, with no CCG profile. */
  opts: { linkOnly?: boolean } = {}
) {
  const role = await db.ccgRole.findUnique({ where: { key: body.role_key } })
  if (!role || !role.active) throw invalid('Role not found or inactive')
  const user = await db.user.findFirst({ where: { id: body.user_id, deletedAt: null } })
  if (!user) throw invalid('User not found')

  const level = role.scopeLevel as ScopeLevel
  const unitIds = {
    campus: body.campus_id ?? null,
    stream: body.stream_id ?? null,
    council: body.council_id ?? null,
    ccg: body.ccg_id ?? null,
    ccf: body.ccf_id ?? null,
  }
  const given = Object.entries(unitIds).filter(([, v]) => v)
  if (level === 'global' && given.length) throw invalid(`${role.name} applies everywhere; do not choose a unit`)
  if (level !== 'global') {
    if (given.length !== 1 || given[0][0] !== level) throw invalid(`${role.name} is assigned to one ${level.toUpperCase()}`)
    const id = given[0][1]!
    const exists =
      level === 'campus'
        ? await db.ccgCampus.findFirst({ where: { id, deletedAt: null } })
        : level === 'stream'
        ? await db.ccgStream.findFirst({ where: { id, deletedAt: null } })
        : level === 'council'
        ? await db.ccgCouncil.findFirst({ where: { id, deletedAt: null } })
        : level === 'ccg'
          ? await db.ccgGroup.findFirst({ where: { id, deletedAt: null } })
          : await db.ccgFamily.findFirst({ where: { id, deletedAt: null } })
    if (!exists) throw invalid(`${level.toUpperCase()} not found`)
  }
  // Every role is held by a member: the login must belong to an active member.
  const member = await db.ccgPerson.findFirst({ where: { userId: user.id, kind: 'member', status: 'active', deletedAt: null } })
  if (!member && !opts.linkOnly) {
    throw invalid(`Roles are given to members: ${userDisplayName(user)} is not an active member`, { reason: 'not_a_member' })
  }

  const a = await db.ccgRoleAssignment.create({
    data: {
      userId: user.id,
      roleKey: role.key,
      campusId: unitIds.campus,
      streamId: unitIds.stream,
      councilId: unitIds.council,
      ccgId: unitIds.ccg,
      ccfId: unitIds.ccf,
      ...(body.starts_on ? { startsOn: new Date(`${body.starts_on}T00:00:00Z`) } : {}),
      assignedBy: actorId,
    },
    include: assignmentInclude,
  })
  await logCcg(
    { userId: actorId, action: 'ROLE_ASSIGNED', entityType: 'ccg_role_assignment', entityId: a.id, newValues: { user_id: user.id, role: role.key, ...unitIds } },
    db
  )
  return a
}

/**
 * Give a member a role in one step: they get their login now if they have
 * none, then the role is assigned. Either way they are emailed: a new login a
 * link to set their password, an existing one a note of the new role.
 */
export async function assignRoleToMember(
  body: {
    person_id: string
    role_key: string
    campus_id?: string | null
    stream_id?: string | null
    council_id?: string | null
    ccg_id?: string | null
    ccf_id?: string | null
    starts_on?: string
  },
  actorId: string,
  origin: string
) {
  const { person_id, ...rest } = body
  const { assignment, created } = await ccgTx(async (tx) => {
    const { userId, created } = await userForMember(person_id, actorId, tx)
    return { assignment: await createAssignment({ ...rest, user_id: userId }, actorId, tx), created }
  })
  // A new login: a link to choose their password. An existing one: a note of the new role.
  const invite = created
    ? await sendInvite({ personId: person_id, role: assignment.role.name, unit: unitName(assignment), origin, actorId })
    : await notifyRole({ userId: assignment.user.id, role: assignment.role.name, unit: unitName(assignment), origin, actorId })
  return { assignment, invite }
}

export const unitName = (a: AssignmentRow) => (a.ccf ?? a.ccg ?? a.council ?? a.stream ?? a.campus)?.name ?? null

/** The role that makes someone a unit's leader, per level. */
export const LEADER_ROLE = {
  campus: 'campus_leader',
  stream: 'overseer',
  council: 'council_leader',
  ccg: 'ccg_governor',
  ccf: 'ccf_coordinator',
} as const
export type LeaderLevel = keyof typeof LEADER_ROLE

/** The role of a unit's admins (any number of them), per level. A CCF has a leader only. */
export const ADMIN_ROLE = {
  campus: 'campus_admin',
  stream: 'stream_admin',
  council: 'council_admin',
  ccg: 'ccg_group_admin',
} as const
export type AdminLevel = keyof typeof ADMIN_ROLE
export const isAdminLevel = (v: unknown): v is AdminLevel => typeof v === 'string' && v in ADMIN_ROLE

/**
 * Make someone the leader of a unit (or clear it with null): ends any other
 * current holder of the unit's leader role and assigns the new one. The leader of a campus, stream, council or
 * CCG may be someone new, who need not be in any CCF
 * (added as a member of the stream, or of none for a campus); a CCF's is one
 * of its members. Anyone without a login is emailed a link to set a password.
 */
export async function setUnitLeader(
  level: LeaderLevel,
  unitId: string,
  appointee: Appointee | null,
  actorId: string,
  origin: string
): Promise<InviteResult | null> {
  let leader: { person_id: string } | null = null
  if (appointee) {
    if (!('person_id' in appointee) && level === 'ccf') throw invalid('A CCF’s coordinator is one of its members')
    leader = { person_id: (await personFor(await streamOf(level, unitId), appointee, actorId)).personId }
  }
  const roleKey = LEADER_ROLE[level]
  const unitField = { campus: 'campusId', stream: 'streamId', council: 'councilId', ccg: 'ccgId', ccf: 'ccfId' }[level]
  const current = await prisma.ccgRoleAssignment.findMany({
    where: { roleKey, [unitField]: unitId, ...currentAssignmentWhere() },
    select: { id: true, userId: true },
  })
  if (!leader) {
    for (const a of current) await endAssignment(a.id, actorId)
    return null
  }
  const person = await prisma.ccgPerson.findFirst({ where: { id: leader.person_id, deletedAt: null }, select: { userId: true } })
  if (person?.userId && current.length === 1 && current[0].userId === person.userId) return null
  for (const a of current) {
    if (a.userId !== person?.userId) await endAssignment(a.id, actorId)
  }
  if (person?.userId && current.some((a) => a.userId === person.userId)) return null
  const { invite } = await assignRoleToMember({ person_id: leader.person_id, role_key: roleKey, [`${level}_id`]: unitId }, actorId, origin)
  return invite
}

/** The stream someone new joins when appointed to this unit (none for a campus or CCF). */
async function streamOf(level: LeaderLevel, unitId: string): Promise<string | null> {
  if (level === 'stream') return unitId
  if (level === 'council') return (await prisma.ccgCouncil.findUnique({ where: { id: unitId }, select: { streamId: true } }))?.streamId ?? null
  if (level === 'ccg') return (await prisma.ccgGroup.findUnique({ where: { id: unitId }, select: { streamId: true } }))?.streamId ?? null
  return null
}

const ADMIN_UNIT_FIELD = { campus: 'campusId', stream: 'streamId', council: 'councilId', ccg: 'ccgId' } as const

/** A campus's, stream's, council's or CCG's current admins. */
export async function unitAdmins(level: AdminLevel, unitId: string) {
  const rows = await prisma.ccgRoleAssignment.findMany({
    where: { roleKey: ADMIN_ROLE[level], [ADMIN_UNIT_FIELD[level]]: unitId, ...currentAssignmentWhere() },
    orderBy: { startsOn: 'asc' },
    select: {
      id: true,
      startsOn: true,
      user: { select: { username: true, firstName: true, lastName: true, ccgPeople: { where: { deletedAt: null }, select: { id: true, fullName: true }, take: 1 } } },
    },
  })
  return rows.map((r) => ({
    assignment_id: r.id,
    person_id: r.user.ccgPeople[0]?.id ?? null,
    name: r.user.ccgPeople[0]?.fullName ?? userDisplayName(r.user),
    since: dateOnly(r.startsOn),
  }))
}

/**
 * Add an admin to a campus, stream, council or CCG (it may have several): an
 * existing member, or someone new (added as a member of the unit's stream, or
 * of none for a campus; no CCF needed). They are emailed either way.
 */
export async function addUnitAdmin(level: AdminLevel, unitId: string, appointee: Appointee, actorId: string, origin: string) {
  const where = { id: unitId, deletedAt: null }
  const exists =
    level === 'campus'
      ? await prisma.ccgCampus.findFirst({ where, select: { id: true } })
      : level === 'stream'
        ? await prisma.ccgStream.findFirst({ where, select: { id: true } })
        : level === 'council'
          ? await prisma.ccgCouncil.findFirst({ where, select: { id: true } })
          : await prisma.ccgGroup.findFirst({ where, select: { id: true } })
  if (!exists) throw notFound({ campus: 'Campus', stream: 'Stream', council: 'Council', ccg: 'CCG' }[level])
  const { personId, reused } = await personFor(await streamOf(level, unitId), appointee, actorId)
  const person = await prisma.ccgPerson.findFirst({ where: { id: personId, deletedAt: null }, select: { userId: true, fullName: true } })
  if (person?.userId) {
    const already = await prisma.ccgRoleAssignment.findFirst({
      where: { userId: person.userId, roleKey: ADMIN_ROLE[level], [ADMIN_UNIT_FIELD[level]]: unitId, ...currentAssignmentWhere() },
    })
    if (already) throw conflict(`${person.fullName} is already an admin here`)
  }
  const { assignment, invite } = await assignRoleToMember({ person_id: personId, role_key: ADMIN_ROLE[level], [`${level}_id`]: unitId }, actorId, origin)
  return { person_id: personId, assignment_id: assignment.id, reused, invite }
}

/** Stand one of a unit's admins down. */
export async function standDownUnitAdmin(level: AdminLevel, unitId: string, assignmentId: string, actorId: string) {
  const a = await prisma.ccgRoleAssignment.findFirst({
    where: { id: assignmentId, roleKey: ADMIN_ROLE[level], [ADMIN_UNIT_FIELD[level]]: unitId, ...currentAssignmentWhere() },
    select: { id: true },
  })
  if (!a) throw notFound('Admin')
  await endAssignment(a.id, actorId)
}

export async function endAssignment(id: string, actorId: string) {
  return withRolesManageKept(async (tx) => {
    const a = await tx.ccgRoleAssignment.findUnique({ where: { id } })
    if (!a) throw notFound('Assignment')
    if (a.endsOn) throw conflict('This assignment has already ended')
    const today = todayDate()
    // ends_on is exclusive; an assignment that starts in the future is simply removed.
    if (a.startsOn > today) await tx.ccgRoleAssignment.delete({ where: { id } })
    else await tx.ccgRoleAssignment.update({ where: { id }, data: { endsOn: today } })
    await logCcg(
      {
        userId: actorId,
        action: 'ROLE_UNASSIGNED',
        entityType: 'ccg_role_assignment',
        entityId: id,
        // Who held which role where, for the unit's history.
        newValues: { user_id: a.userId, role: a.roleKey, campus: a.campusId, stream: a.streamId, council: a.councilId, ccg: a.ccgId, ccf: a.ccfId },
      },
      tx
    )
    return a
  })
}
