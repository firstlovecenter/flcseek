import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere } from '../access'
import { conflict, invalid, notFound } from '../errors'
import type { CcgScope } from '../scope'
import { iso, logCcg, userDisplayName } from './common'
import { ensure } from './handler'
import { createWithCode } from './units'

/**
 * Sheep seeking groups: a stream's converts are split into groups, and Sheep
 * Seekers are assigned to groups to look after those converts through their
 * milestones, in whatever CCF they are placed. The stream's Sheep Seeking
 * Overseer (seekers.manage on the stream) runs them.
 */

const DAY = 86_400_000

async function load(id: string) {
  const g = await prisma.ccgSeekingGroup.findFirst({ where: { id, deletedAt: null } })
  if (!g) throw notFound('Sheep seeking group')
  return g
}

const canSee = (scope: CcgScope, g: { id: string; streamId: string }) => scope.canOnStream('people.view', g.streamId) || scope.seekingGroupIds.includes(g.id)
const canManage = (scope: CcgScope, streamId: string) => scope.can('seekers.manage') || scope.canOnStream('seekers.manage', streamId)

/** A stream's groups (or, for a Sheep Seeker, their own), with how many seekers and converts each has. */
export async function listSeekingGroups(scope: CcgScope, streamId: string | null) {
  const streams = scope.streamIds('people.view')
  const where = {
    deletedAt: null,
    ...(streamId ? { streamId } : {}),
    OR: [...(streams === 'all' ? [{}] : [{ streamId: { in: streams } }]), { id: { in: scope.seekingGroupIds } }],
  }
  const rows = await prisma.ccgSeekingGroup.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      stream: { select: { id: true, name: true } },
      _count: { select: { seekers: true, converts: { where: { deletedAt: null } } } },
      seekers: { take: 4, select: { user: { select: { username: true, firstName: true, lastName: true, ccgPeople: { where: { deletedAt: null }, select: { fullName: true }, take: 1 } } } } },
    },
  })
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    status: g.status,
    notes: g.notes,
    stream: g.stream,
    seeker_count: g._count.seekers,
    convert_count: g._count.converts,
    seekers: g.seekers.map((s) => s.user.ccgPeople[0]?.fullName ?? userDisplayName(s.user)),
    created_at: iso(g.createdAt),
  }))
}

export async function createSeekingGroup(scope: CcgScope, body: { stream_id: string; name: string; notes?: string | null }, actorId: string) {
  ensure(canManage(scope, body.stream_id), 'Only the stream’s Sheep Seeking Overseer can create its groups')
  const stream = await prisma.ccgStream.findFirst({ where: { id: body.stream_id, deletedAt: null } })
  if (!stream) throw notFound('Stream')
  const g = await createWithCode('seeking_group', undefined, (code) =>
    prisma.ccgSeekingGroup.create({ data: { code, streamId: body.stream_id, name: body.name, notes: body.notes ?? null, createdBy: actorId } })
  )
  await logCcg({ userId: actorId, action: 'SEEKING_GROUP_CREATED', entityType: 'ccg_seeking_group', entityId: g.id, newValues: body })
  return g
}

export async function updateSeekingGroup(scope: CcgScope, id: string, body: { name?: string; notes?: string | null; status?: 'active' | 'inactive' }, actorId: string) {
  const g = await load(id)
  ensure(canManage(scope, g.streamId), 'Only the stream’s Sheep Seeking Overseer can change its groups')
  await prisma.ccgSeekingGroup.update({ where: { id }, data: { ...body, updatedAt: new Date() } })
  await logCcg({ userId: actorId, action: 'SEEKING_GROUP_UPDATED', entityType: 'ccg_seeking_group', entityId: id, oldValues: g, newValues: body })
}

/** Close a group: it must have no converts left (move them to another group first). */
export async function removeSeekingGroup(scope: CcgScope, id: string, actorId: string) {
  const g = await load(id)
  ensure(canManage(scope, g.streamId), 'Only the stream’s Sheep Seeking Overseer can close its groups')
  if (await prisma.ccgPerson.count({ where: { seekingGroupId: id, deletedAt: null } })) throw conflict('Move this group’s converts to another group first')
  await prisma.$transaction([
    prisma.ccgSeekingGroupSeeker.deleteMany({ where: { groupId: id } }),
    prisma.ccgSeekingGroup.update({ where: { id }, data: { deletedAt: new Date(), status: 'inactive' } }),
  ])
  await logCcg({ userId: actorId, action: 'SEEKING_GROUP_REMOVED', entityType: 'ccg_seeking_group', entityId: id })
}

/** One group: its Sheep Seekers and its converts (with where each is placed). */
export async function seekingGroupDetail(scope: CcgScope, id: string) {
  const g = await load(id)
  ensure(canSee(scope, g), 'You can only see your groups')
  const [stream, seekers, converts] = await Promise.all([
    prisma.ccgStream.findUnique({ where: { id: g.streamId }, select: { id: true, name: true } }),
    prisma.ccgSeekingGroupSeeker.findMany({
      where: { groupId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        userId: true,
        createdAt: true,
        user: { select: { username: true, firstName: true, lastName: true, ccgPeople: { where: { deletedAt: null }, select: { id: true, fullName: true }, take: 1 } } },
      },
    }),
    prisma.ccgPerson.findMany({
      where: { seekingGroupId: id, deletedAt: null },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        phone: true,
        status: true,
        createdAt: true,
        placements: { where: { status: { in: ['active', 'proposed', 'held'] } }, select: { status: true, finalCcf: { select: { name: true } }, proposedCcf: { select: { name: true } } } },
      },
    }),
  ])
  const now = Date.now()
  return {
    group: { id: g.id, name: g.name, status: g.status, notes: g.notes, stream, created_at: iso(g.createdAt) },
    can_manage: canManage(scope, g.streamId),
    seekers: seekers.map((s) => ({
      user_id: s.userId,
      person_id: s.user.ccgPeople[0]?.id ?? null,
      name: s.user.ccgPeople[0]?.fullName ?? userDisplayName(s.user),
      since: iso(s.createdAt),
    })),
    converts: converts.map((c) => {
      const active = c.placements.find((p) => p.status === 'active')
      const open = c.placements.find((p) => p.status !== 'active')
      return {
        id: c.id,
        full_name: c.fullName,
        phone: c.phone,
        status: c.status,
        ccf: active?.finalCcf?.name ?? open?.proposedCcf?.name ?? null,
        days: c.createdAt ? Math.floor((now - c.createdAt.getTime()) / DAY) : null,
      }
    }),
  }
}

/** Assign a Sheep Seeker of the group's stream (by login) to the group. */
export async function addGroupSeeker(scope: CcgScope, id: string, userId: string, actorId: string) {
  const g = await load(id)
  ensure(canManage(scope, g.streamId), 'Only the stream’s Sheep Seeking Overseer can assign Sheep Seekers to groups')
  const seeks = await prisma.ccgRoleAssignment.count({ where: { userId, roleKey: 'sheep_seeker', streamId: g.streamId, ...currentAssignmentWhere() } })
  if (!seeks) throw invalid('Only Sheep Seekers of this stream can be assigned to its groups')
  await prisma.ccgSeekingGroupSeeker.upsert({
    where: { groupId_userId: { groupId: id, userId } },
    create: { groupId: id, userId, assignedBy: actorId },
    update: {},
  })
  await logCcg({ userId: actorId, action: 'SEEKING_GROUP_SEEKER_ADDED', entityType: 'ccg_seeking_group', entityId: id, newValues: { user_id: userId } })
}

export async function removeGroupSeeker(scope: CcgScope, id: string, userId: string, actorId: string) {
  const g = await load(id)
  ensure(canManage(scope, g.streamId), 'Only the stream’s Sheep Seeking Overseer can change who is in a group')
  await prisma.ccgSeekingGroupSeeker.deleteMany({ where: { groupId: id, userId } })
  await logCcg({ userId: actorId, action: 'SEEKING_GROUP_SEEKER_REMOVED', entityType: 'ccg_seeking_group', entityId: id, newValues: { user_id: userId } })
}

/** Put converts of the group's stream into the group (moving them from any other group). */
export async function addGroupConverts(scope: CcgScope, id: string, personIds: string[], actorId: string) {
  const g = await load(id)
  ensure(canManage(scope, g.streamId), 'Only the stream’s Sheep Seeking Overseer can put converts in groups')
  const people = await prisma.ccgPerson.findMany({ where: { id: { in: personIds }, deletedAt: null }, select: { id: true, kind: true, streamId: true } })
  const wrong = people.find((p) => p.kind !== 'convert' || p.streamId !== g.streamId)
  if (wrong || people.length !== personIds.length) throw invalid('Only converts of this stream can be put in its groups')
  await prisma.ccgPerson.updateMany({ where: { id: { in: personIds } }, data: { seekingGroupId: id, updatedAt: new Date() } })
  await logCcg({ userId: actorId, action: 'SEEKING_GROUP_CONVERTS_ADDED', entityType: 'ccg_seeking_group', entityId: id, newValues: { person_ids: personIds } })
}

export async function removeGroupConvert(scope: CcgScope, id: string, personId: string, actorId: string) {
  const g = await load(id)
  ensure(canManage(scope, g.streamId), 'Only the stream’s Sheep Seeking Overseer can take converts out of groups')
  await prisma.ccgPerson.updateMany({ where: { id: personId, seekingGroupId: id }, data: { seekingGroupId: null, updatedAt: new Date() } })
  await logCcg({ userId: actorId, action: 'SEEKING_GROUP_CONVERT_REMOVED', entityType: 'ccg_seeking_group', entityId: id, newValues: { person_id: personId } })
}
