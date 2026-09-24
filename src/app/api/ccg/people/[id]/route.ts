import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { invalid, notFound } from '@/lib/ccg/errors'
import { personUpdateSchema, type PersonUpdate } from '@/lib/ccg/schemas'
import { iso, num } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { canOnPerson, personInclude, removePerson, serializePerson, updatePerson } from '@/lib/ccg/server/people'
import { loadAnswers, loadQuestionBank } from '@/lib/ccg/server/questions'

export const dynamic = 'force-dynamic'
type P = { id: string }

async function load(id: string) {
  const p = await prisma.ccgPerson.findFirst({ where: { id, deletedAt: null }, include: personInclude })
  if (!p) throw notFound('Person')
  return p
}

/** GET /api/ccg/people/[id] — profile, answers, and placement history. */
export const GET = withCcg<undefined, P>({ permission: 'people.view' }, async ({ scope, params }) => {
  const p = await load(params.id)
  ensure(canOnPerson(scope, 'people.view', p), 'You can only view people in your scope')
  const bank = await loadQuestionBank()
  const [answers, history, transfers] = await Promise.all([
    loadAnswers([p.id], bank),
    prisma.ccgPlacement.findMany({
      where: { personId: p.id },
      include: { proposedCcf: true, finalCcf: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ccgTransfer.findMany({
      where: { personId: p.id },
      include: { fromCcf: true, toCcf: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  return success({
    person: serializePerson(p, answers.get(p.id) ?? {}),
    placements: history.map((h) => ({
      id: h.id,
      status: h.status,
      proposed_ccf: h.proposedCcf ? { id: h.proposedCcf.id, code: h.proposedCcf.code, name: h.proposedCcf.name } : null,
      proposed_score: num(h.proposedScore),
      final_ccf: h.finalCcf ? { id: h.finalCcf.id, code: h.finalCcf.code, name: h.finalCcf.name } : null,
      decision: h.decision,
      override_reason: h.overrideReason,
      hold_reason: h.holdReason,
      decided_at: iso(h.decidedAt),
      ended_at: iso(h.endedAt),
      end_reason: h.endReason,
      outcome: h.outcome,
      created_at: iso(h.createdAt),
    })),
    transfers: transfers.map((t) => ({
      id: t.id,
      from_ccf: t.fromCcf ? { id: t.fromCcf.id, code: t.fromCcf.code, name: t.fromCcf.name } : null,
      to_ccf: { id: t.toCcf.id, code: t.toCcf.code, name: t.toCcf.name },
      reason: t.reason,
      over_capacity: t.overCapacity,
      created_at: iso(t.createdAt),
    })),
  })
})

/**
 * PATCH /api/ccg/people/[id] — core fields and/or answers (keyed by question
 * key). A waiting convert whose answers change is re-matched automatically.
 * Moving a member to another CCF needs people.manage on both CCFs.
 */
export const PATCH = withCcg<PersonUpdate, P>({ permission: 'people.manage', schema: personUpdateSchema }, async ({ user, scope, body, params }) => {
  const p = await load(params.id)
  ensure(canOnPerson(scope, 'people.manage', p), 'You can only edit people in your scope')
  if (p.kind === 'member' && body.ccf_id && body.ccf_id !== p.ccfId) {
    throw invalid('Use transfer to move a member to another CCF, so the move is recorded')
  }
  if (p.kind === 'convert' && body.stream_id !== undefined && body.stream_id !== p.streamId) {
    ensure(
      scope.can('people.manage') || (!!body.stream_id && scope.canOnStream('people.manage', body.stream_id)),
      'You can only move converts into your stream'
    )
  }
  const { proposal } = await updatePerson(p.id, body, { actorId: user.id, source: 'staff' })
  return success({
    id: p.id,
    proposal: proposal ? { placement_id: proposal.placement.id, status: proposal.placement.status, ccf_id: proposal.placement.proposedCcfId } : null,
  })
})

/** DELETE /api/ccg/people/[id] — soft delete; ends placements and proposals. */
export const DELETE = withCcg<undefined, P>({ permission: 'people.manage' }, async ({ user, scope, params }) => {
  const p = await load(params.id)
  ensure(canOnPerson(scope, 'people.manage', p), 'You can only remove people in your scope')
  await removePerson(p.id, user.id)
  return success({ id: p.id })
})
