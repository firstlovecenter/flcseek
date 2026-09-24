import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/ccg/errors'
import { CCF_UNIT_EDIT_FIELDS, ccfUpdateSchema } from '@/lib/ccg/schemas'
import { getCcgConfig, logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { setUnitLeader } from '@/lib/ccg/server/roles'
import { personInclude, serializePerson } from '@/lib/ccg/server/people'
import { loadProfiles } from '@/lib/ccg/server/profiles'
import { loadQuestionBank } from '@/lib/ccg/server/questions'
import {
  assertCapacityFits,
  assertCcfEmpty,
  assertCcgExists,
  ccfInclude,
  serializeCcf,
  serializeProfile,
} from '@/lib/ccg/server/units'

export const dynamic = 'force-dynamic'
type P = { id: string }
type Body = z.infer<typeof ccfUpdateSchema>

async function load(id: string) {
  const f = await prisma.ccgFamily.findFirst({ where: { id, deletedAt: null, ccg: { deletedAt: null } }, include: ccfInclude })
  if (!f) throw notFound('CCF')
  return f
}

/** GET /api/ccg/ccfs/[id] — CCF, profile, members, placed converts and incoming proposals. */
export const GET = withCcg<undefined, P>({}, async ({ scope, params }) => {
  const f = await load(params.id)
  ensure(scope.canOnCcf('people.view', f.id), 'You can only view CCFs in your scope')
  const [bank, config, members, placed, proposed] = await Promise.all([
    loadQuestionBank(),
    getCcgConfig(),
    prisma.ccgPerson.findMany({ where: { kind: 'member', ccfId: f.id, deletedAt: null }, include: personInclude, orderBy: { fullName: 'asc' } }),
    prisma.ccgPerson.findMany({
      where: { kind: 'convert', deletedAt: null, placements: { some: { status: 'active', finalCcfId: f.id } } },
      include: personInclude,
      orderBy: { fullName: 'asc' },
    }),
    prisma.ccgPerson.findMany({
      where: { kind: 'convert', deletedAt: null, placements: { some: { status: 'proposed', proposedCcfId: f.id } } },
      include: personInclude,
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const { byCcf } = await loadProfiles({ bank, config, ccfIds: [f.id] })
  const p = byCcf.get(f.id)
  return success({
    ccf: serializeCcf(f),
    profile: p ? serializeProfile(p, bank) : null,
    members: members.map((m) => serializePerson(m)),
    placed_converts: placed.map((c) => serializePerson(c)),
    incoming_proposals: proposed.map((c) => serializePerson(c)),
  })
})

/**
 * PATCH /api/ccg/ccfs/[id]
 * structure.manage: anything. units.edit (e.g. a CCG Governor): details only —
 * name, meeting time/place, capacity, notes.
 */
export const PATCH = withCcg<Body, P>({ schema: ccfUpdateSchema }, async ({ request, user, scope, body, params }) => {
  const before = await load(params.id)
  const full = scope.can('structure.manage')
  if (!full) {
    ensure(scope.canOnCcf('units.edit', before.id))
    const extra = Object.keys(body).filter((k) => !(CCF_UNIT_EDIT_FIELDS as readonly string[]).includes(k))
    ensure(extra.length === 0, `You can only change: ${CCF_UNIT_EDIT_FIELDS.join(', ')}`)
  }
  if (body.leader !== undefined) ensure(scope.can('roles.manage'), 'Setting a leader needs permission to manage roles')
  if (body.ccg_id) await assertCcgExists(body.ccg_id)
  if (body.capacity !== undefined) await assertCapacityFits(before.id, body.capacity)

  await prisma.ccgFamily.update({
    where: { id: params.id },
    data: {
      ...(body.ccg_id !== undefined ? { ccgId: body.ccg_id } : {}),
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.meeting_location !== undefined ? { meetingLocation: body.meeting_location } : {}),
      ...(body.meeting_day !== undefined ? { meetingDay: body.meeting_day } : {}),
      ...(body.meeting_time !== undefined ? { meetingTime: body.meeting_time } : {}),
      ...(body.meeting_frequency !== undefined ? { meetingFrequency: body.meeting_frequency } : {}),
      ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      updatedAt: new Date(),
    },
  })
  const leader_invite =
    body.leader !== undefined ? await setUnitLeader('ccf', params.id, body.leader, user.id, new URL(request.url).origin) : null
  await logCcg({ userId: user.id, action: 'CCF_UPDATED', entityType: 'ccg_family', entityId: params.id, oldValues: before, newValues: body })
  return success({ id: params.id, leader_invite })
})

/** DELETE /api/ccg/ccfs/[id] — soft delete; must be empty (no members, placements or proposals). */
export const DELETE = withCcg<undefined, P>({ permission: 'structure.manage' }, async ({ user, scope, params }) => {
  ensure(scope.can('structure.manage'))
  await load(params.id)
  await assertCcfEmpty(params.id)
  await prisma.$transaction([
    prisma.ccgRoleAssignment.updateMany({ where: { ccfId: params.id, endsOn: null }, data: { endsOn: new Date() } }),
    prisma.ccgFormLink.updateMany({ where: { ccfId: params.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.ccgFamily.update({ where: { id: params.id }, data: { deletedAt: new Date(), status: 'inactive' } }),
  ])
  await logCcg({ userId: user.id, action: 'CCF_DELETED', entityType: 'ccg_family', entityId: params.id })
  return success({ id: params.id })
})
