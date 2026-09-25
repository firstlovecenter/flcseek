import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere, SEEK_SUPERADMIN, todayDate } from '../access'
import { conflict, invalid, notFound } from '../errors'
import type { ScopeLevel } from '../permissions'
import { ccgTx, dateOnly, iso, logCcg, userDisplayName, type Db } from './common'
import { sendInvite, userForMember, type InviteResult } from './member-login'

export const assignmentInclude = {
  role: true,
  campus: { select: { id: true, code: true, name: true } },
  stream: { select: { id: true, code: true, name: true } },
  user: { select: { id: true, username: true, firstName: true, lastName: true, role: true, deletedAt: true } },
  council: { select: { id: true, code: true, name: true } },
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
    const superadmins = await tx.user.count({ where: { role: SEEK_SUPERADMIN, deletedAt: null } })
    if (superadmins > 0) return out
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
  body: { user_id: string; role_key: string; campus_id?: string | null; stream_id?: string | null; council_id?: string | null; ccg_id?: string | null; ccf_id?: string | null; starts_on?: string },
  actorId: string,
  db: Db = prisma
) {
  const role = await db.ccgRole.findUnique({ where: { key: body.role_key } })
  if (!role || !role.active) throw invalid('Role not found or inactive')
  const user = await db.user.findFirst({ where: { id: body.user_id, deletedAt: null } })
  if (!user) throw invalid('User not found')

  const level = role.scopeLevel as ScopeLevel
  const unitIds = { campus: body.campus_id ?? null, stream: body.stream_id ?? null, council: body.council_id ?? null, ccg: body.ccg_id ?? null, ccf: body.ccf_id ?? null }
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
  if (!member) {
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
 * none (username and password in `login`), then the role is assigned.
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
  // A new login: email the member a link to choose their password.
  const invite = created
    ? await sendInvite({ personId: person_id, role: assignment.role.name, unit: unitName(assignment), origin, actorId })
    : null
  return { assignment, invite }
}

const unitName = (a: AssignmentRow) => (a.ccf ?? a.ccg ?? a.council ?? a.stream ?? a.campus)?.name ?? null

/** The role that makes someone a unit's leader, per level. */
export const LEADER_ROLE = {
  campus: 'campus_leader',
  council: 'overseer',
  ccg: 'ccg_governor',
  ccf: 'ccf_coordinator',
} as const
export type LeaderLevel = keyof typeof LEADER_ROLE

/**
 * Make a member the leader of a unit (or clear it with null): ends any other
 * current holder of the unit's leader role and assigns the new one. A member
 * without a login gets one from `leader.login`.
 */
export async function setUnitLeader(
  level: LeaderLevel,
  unitId: string,
  leader: { person_id: string } | null,
  actorId: string,
  origin: string
): Promise<InviteResult | null> {
  const roleKey = LEADER_ROLE[level]
  const unitField = level === 'campus' ? 'campusId' : level === 'council' ? 'councilId' : level === 'ccg' ? 'ccgId' : 'ccfId'
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

export async function endAssignment(id: string, actorId: string) {
  return withRolesManageKept(async (tx) => {
    const a = await tx.ccgRoleAssignment.findUnique({ where: { id } })
    if (!a) throw notFound('Assignment')
    if (a.endsOn) throw conflict('This assignment has already ended')
    const today = todayDate()
    // ends_on is exclusive; an assignment that starts in the future is simply removed.
    if (a.startsOn > today) await tx.ccgRoleAssignment.delete({ where: { id } })
    else await tx.ccgRoleAssignment.update({ where: { id }, data: { endsOn: today } })
    await logCcg({ userId: actorId, action: 'ROLE_UNASSIGNED', entityType: 'ccg_role_assignment', entityId: id }, tx)
    return a
  })
}
