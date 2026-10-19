import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { invalid, notFound } from '@/lib/ccg/errors'
import { CONVERT_NAME_FIELDS, PERSON_EDIT_FIELDS, personUpdateSchema, type PersonUpdate } from '@/lib/ccg/schemas'
import { iso, num } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { canEditContact, canEditDetails, canEditPerson, canOnPerson, isPlaced, isSeekerOf, personInclude, removePerson, serializePerson, updatePerson } from '@/lib/ccg/server/people'
import { loadAnswerNotes, loadAnswers, loadQuestionBank } from '@/lib/ccg/server/questions'
import { OWNER_GRANT } from '@/lib/ccg/server/scope-loader'

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
  const [answers, notes, history, transfers] = await Promise.all([
    loadAnswers([p.id], bank),
    loadAnswerNotes([p.id], bank),
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
    person: serializePerson(p, answers.get(p.id) ?? {}, notes.get(p.id) ?? {}),
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
 * key). Only a superadmin may change more than phone and email (PERSON_EDIT_FIELDS; Sheep Seekers also converts' names). A waiting convert whose answers change is re-matched automatically.
 * Moving a member to another CCF needs people.manage on both CCFs.
 */
export const PATCH = withCcg<PersonUpdate, P>({ schema: personUpdateSchema }, async ({ user, scope, body, params }) => {
  const p = await load(params.id)
  const owner = scope.roleKeys.includes(OWNER_GRANT.roleKey)
  ensure(
    owner ? canEditDetails(scope, p) : canEditContact(scope, p),
    p.kind === 'member'
      ? 'Only the admins over this member edit their phone number and email'
      : isPlaced(p)
        ? 'Only their Sheep Seekers, the admins over this convert’s CCF, or their stream’s Sheep Seeking Admin edit their contact details'
        : 'Only Sheep Seekers edit converts in their care'
  )
  // Apart from a superadmin, people's phone number and email are all anyone may change;
  // Sheep Seekers may also correct the names of converts in their care.
  if (!owner) {
    const seeker = isSeekerOf(scope, p)
    const allowed: readonly string[] = seeker ? [...PERSON_EDIT_FIELDS, ...CONVERT_NAME_FIELDS] : PERSON_EDIT_FIELDS
    const other = Object.keys(body).filter((k) => body[k as keyof PersonUpdate] !== undefined && !allowed.includes(k))
    ensure(
      other.length === 0,
      seeker
        ? 'Only names, phone numbers and emails can be changed. Ask a superadmin to change anything else.'
        : 'Only phone numbers and emails can be changed. Ask a superadmin to change anything else.'
    )
  }
  if (p.kind === 'member' && body.ccf_id && body.ccf_id !== p.ccfId) {
    throw invalid('Use transfer to move a member to another CCF, so the move is recorded')
  }
  if (p.kind === 'convert' && body.stream_id !== undefined && body.stream_id !== p.streamId) {
    ensure(
      scope.can('people.manage') || (!!body.stream_id && scope.sheepSeeking().canOnStream('people.manage', body.stream_id)),
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
export const DELETE = withCcg<undefined, P>({}, async ({ user, scope, params }) => {
  const p = await load(params.id)
  ensure(canEditPerson(scope, p), p.kind === 'member' ? 'Only the Church Admin, or a Stream Admin, Council Leader or Council Admin over this member, removes them' : 'You can only remove people in your scope')
  await removePerson(p.id, user.id)
  return success({ id: p.id })
})
