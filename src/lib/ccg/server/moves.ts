import { prisma } from '@/lib/prisma'
import { conflict, notFound } from '../errors'
import { ccgTx, iso, logCcg, normalizePhone, type Db } from './common'
import { queueMoveRequestSms } from './notify'
import { createPerson, type CreatePersonArgs } from './people'
import { transferPerson } from './placements'

/**
 * Registering someone who is already in the CCG app (user, 2026-10-05).
 *
 * The same person is found by phone number: for a member the number alone,
 * for a convert the number and first name (converts often share a parent's
 * phone). If they already belong to another CCF (a member there, or a convert
 * placed there), registering them into a CCF does not create a second record:
 * it becomes a move request, which the coordinator of their current CCF
 * approves (they are then transferred, keeping everything) or declines.
 * Registering them where they already are, or as a convert into a stream when
 * they are already registered, is refused.
 */

export interface ExistingPerson {
  id: string
  kind: string
  fullName: string
  status: string
  /** Their CCF: a member's, or the CCF a convert is placed in. */
  ccf: { id: string; name: string } | null
}

/** The person this registration is for, if they are already registered. */
export async function findExisting(
  db: Db,
  kind: 'member' | 'convert',
  rawPhone: string | null | undefined,
  firstName: string
): Promise<ExistingPerson | null> {
  const phone = normalizePhone(rawPhone)
  if (!phone) return null
  const p = await db.ccgPerson.findFirst({
    where: {
      kind,
      phone,
      deletedAt: null,
      status: { notIn: ['inactive'] },
      ...(kind === 'convert' ? { firstName: { equals: firstName.trim(), mode: 'insensitive' as const } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      kind: true,
      fullName: true,
      status: true,
      ccf: { select: { id: true, name: true, deletedAt: true } },
      placements: { where: { status: 'active' }, select: { finalCcf: { select: { id: true, name: true, deletedAt: true } } }, take: 1 },
    },
  })
  if (!p) return null
  const ccf = kind === 'member' ? p.ccf : p.placements[0]?.finalCcf ?? null
  return { id: p.id, kind: p.kind, fullName: p.fullName, status: p.status, ccf: ccf && !ccf.deletedAt ? { id: ccf.id, name: ccf.name } : null }
}

export type Registration =
  | { outcome: 'created'; person: Awaited<ReturnType<typeof createPerson>>['person']; proposal: Awaited<ReturnType<typeof createPerson>>['proposal'] }
  | { outcome: 'move_requested'; requestId: string; person: ExistingPerson; fromCcf: { id: string; name: string } | null }

/**
 * Register a member or convert, or, when they already belong to another CCF,
 * ask to move them into `intoCcfId` instead. `intoCcfId` is the CCF being
 * registered into (a member's CCF, or the CCF a leader registers a convert
 * straight into); null for a convert registered into a stream.
 */
export async function registerOrRequestMove(args: CreatePersonArgs, intoCcfId: string | null): Promise<Registration> {
  const existing = await findExisting(prisma, args.kind, args.core.phone, args.core.first_name)
  if (!existing) {
    const { person, proposal } = await createPerson(args)
    return { outcome: 'created', person, proposal }
  }

  const self = args.source === 'self'
  const who = self ? 'You are' : `${existing.fullName} is`
  if (!intoCcfId) {
    throw conflict(
      existing.ccf
        ? `${who} already registered and placed in ${existing.ccf.name}.`
        : `${who} already registered${existing.kind === 'convert' ? ' and waiting to be placed' : ''}.`,
      { reason: 'already_registered', existing_id: self ? undefined : existing.id }
    )
  }
  if (existing.ccf?.id === intoCcfId) {
    throw conflict(`${who} already ${existing.kind === 'member' ? 'a member of' : 'placed in'} this CCF.`, {
      reason: 'already_here',
      existing_id: self ? undefined : existing.id,
    })
  }
  if (!existing.ccf && existing.kind === 'convert') {
    throw conflict(`${who} already registered and waiting to be placed. The Sheep Seeking team can place ${self ? 'you' : 'them'} in this CCF.`, {
      reason: 'already_registered',
      existing_id: self ? undefined : existing.id,
    })
  }

  const fromCcf = existing.ccf
  const requestId = await ccgTx(async (tx) => {
    const to = await tx.ccgFamily.findFirst({ where: { id: intoCcfId, deletedAt: null }, select: { id: true } })
    if (!to) throw notFound('CCF')
    // Registering twice (or the form submitted again) keeps the one open request.
    const open = await tx.ccgMoveRequest.findFirst({ where: { personId: existing.id, toCcfId: intoCcfId, status: 'pending' }, select: { id: true } })
    if (open) return open.id
    const r = await tx.ccgMoveRequest.create({
      data: {
        personId: existing.id,
        kind: existing.kind,
        fromCcfId: fromCcf?.id ?? null,
        toCcfId: intoCcfId,
        source: args.source,
        requestedBy: args.actorId,
      },
    })
    await logCcg(
      {
        userId: args.actorId,
        action: 'MOVE_REQUESTED',
        entityType: 'ccg_person',
        entityId: existing.id,
        newValues: { request_id: r.id, from_ccf_id: fromCcf?.id ?? null, to_ccf_id: intoCcfId, source: args.source },
      },
      tx
    )
    return r.id
  })
  if (fromCcf) queueMoveRequestSms(fromCcf.id, requestId, args.actorId)
  return { outcome: 'move_requested', requestId, person: existing, fromCcf }
}

// ---------------------------------------------------------------------------
// Deciding
// ---------------------------------------------------------------------------

/** The CCF whose coordinator decides: where they are now, else where they asked to go. */
export const deciderCcfId = (r: { fromCcfId: string | null; toCcfId: string }) => r.fromCcfId ?? r.toCcfId

async function openRequest(id: string) {
  const r = await prisma.ccgMoveRequest.findUnique({ where: { id }, include: { person: true, toCcf: true, fromCcf: true } })
  if (!r || r.person.deletedAt) throw notFound('Move request')
  if (r.status !== 'pending') throw conflict(`This request has already been ${r.status}`)
  return r
}

export async function loadMoveRequest(id: string) {
  const r = await prisma.ccgMoveRequest.findUnique({ where: { id } })
  if (!r) throw notFound('Move request')
  return r
}

/** Approve: they are transferred to the CCF they asked for (a convert keeps their milestones). */
export async function approveMove(id: string, actorId: string) {
  const r = await openRequest(id)
  if (r.toCcf.deletedAt || r.toCcf.status !== 'active') throw conflict(`${r.toCcf.name} is no longer active. Decline this request.`)
  const by = r.source === 'self' ? 'they asked' : 'requested'
  await transferPerson(r.personId, r.toCcfId, `Moved to ${r.toCcf.name}: ${by} when registering there`, actorId)
  await prisma.ccgMoveRequest.update({ where: { id }, data: { status: 'approved', decidedBy: actorId, decidedAt: new Date() } })
  // Any other open request for them is now out of date.
  await prisma.ccgMoveRequest.updateMany({ where: { personId: r.personId, status: 'pending' }, data: { status: 'cancelled', decidedAt: new Date() } })
  await logCcg({ userId: actorId, action: 'MOVE_APPROVED', entityType: 'ccg_person', entityId: r.personId, newValues: { request_id: id, to_ccf_id: r.toCcfId } })
}

/** Decline: they stay where they are. */
export async function declineMove(id: string, reason: string | null, actorId: string) {
  const r = await openRequest(id)
  await prisma.ccgMoveRequest.update({ where: { id }, data: { status: 'declined', declineReason: reason, decidedBy: actorId, decidedAt: new Date() } })
  await logCcg({ userId: actorId, action: 'MOVE_DECLINED', entityType: 'ccg_person', entityId: r.personId, newValues: { request_id: id, reason } })
}

export async function listMoveRequests(where: { ccfIds: string[] | 'all'; status: string }) {
  const inScope = where.ccfIds === 'all' ? {} : { OR: [{ fromCcfId: { in: where.ccfIds } }, { toCcfId: { in: where.ccfIds } }, { fromCcfId: null, toCcfId: { in: where.ccfIds } }] }
  const rows = await prisma.ccgMoveRequest.findMany({
    where: { status: where.status, person: { deletedAt: null }, ...inScope },
    include: {
      person: { select: { id: true, fullName: true, phone: true, kind: true } },
      fromCcf: { select: { id: true, name: true } },
      toCcf: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    source: r.source,
    person: { id: r.person.id, full_name: r.person.fullName, phone: r.person.phone },
    from_ccf: r.fromCcf,
    to_ccf: { id: r.toCcf.id, name: r.toCcf.name },
    decider_ccf_id: deciderCcfId(r),
    decline_reason: r.declineReason,
    created_at: iso(r.createdAt),
    decided_at: iso(r.decidedAt),
  }))
}
