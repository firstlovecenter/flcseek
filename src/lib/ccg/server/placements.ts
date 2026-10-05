import { prisma } from '@/lib/prisma'
import { CcgError, conflict, invalid, notFound } from '../errors'
import { ccgTx, logCcg, type Tx } from './common'
import { lockRow, proposeFor, PROPOSABLE_STATUSES, type StoredMatchResults } from './mapping'
import { graduateIfComplete } from './graduation'
import { syncAutoMilestones } from './progress'
import { queueNewConvertSms } from './notify'
import { convertLimitFor } from '../engine/profile'

/**
 * Placement lifecycle. Every decision re-checks the CCF under a row lock, so
 * two approvals racing for a CCF's last seat cannot both succeed.
 *
 *   proposed ──approve──▶ active ──end──▶ ended
 *      │  └──remap (reason)──▶ active
 *      └──hold──▶ held ──remap──▶ active
 *   (proposed | held) ──new proposal──▶ superseded
 */

/**
 * A CCF holds at most CONVERTS_PER_MEMBER converts per active member. This is
 * a hard limit: nobody can place past it, whatever their rights.
 */
export async function assertConvertRoom(tx: Tx, ccfId: string, unitName: string) {
  const [members, converts] = await Promise.all([
    tx.ccgPerson.count({ where: { kind: 'member', status: 'active', deletedAt: null, ccfId } }),
    tx.ccgPlacement.count({ where: { status: 'active', finalCcfId: ccfId, person: { deletedAt: null } } }),
  ])
  const limit = convertLimitFor(members)
  if (converts >= limit) {
    throw conflict(
      `${unitName} has ${members} member${members === 1 ? '' : 's'}, so it can take at most ${limit} convert${limit === 1 ? '' : 's'} and already has ${converts}. Choose another CCF.`,
      { reason: 'convert_limit' }
    )
  }
}

/** Lock the CCF and check it can take one more person. */
async function checkSeat(
  tx: Tx,
  ccfId: string,
  person: { dateOfBirth: Date | null; kind?: string },
  opts: { ignoreConvertLimit?: boolean } = {}
): Promise<void> {
  await lockRow(tx, 'ccg_families', ccfId)
  const unit = await tx.ccgFamily.findUnique({ where: { id: ccfId }, include: { ccg: true } })
  if (!unit || unit.deletedAt || unit.ccg.deletedAt) throw notFound('CCF')
  if (unit.status !== 'active' || unit.ccg.status !== 'active') {
    throw conflict(`${unit.name} or its CCG is no longer active. Rescore to propose another CCF.`)
  }
  if (person.kind !== 'member' && !opts.ignoreConvertLimit) await assertConvertRoom(tx, ccfId, unit.name)
}

async function scoreFromRun(tx: Tx, matchRunId: string | null, ccfId: string): Promise<number | null> {
  if (!matchRunId) return null
  const run = await tx.ccgMatchRun.findUnique({ where: { id: matchRunId }, select: { results: true } })
  const r = run?.results as unknown as StoredMatchResults | undefined
  return [...(r?.eligible ?? []), ...(r?.ineligible ?? [])].find((u) => u.ccf_id === ccfId)?.overall ?? null
}

async function openPlacement(tx: Tx, placementId: string, allowed: string[]) {
  const p = await tx.ccgPlacement.findUnique({ where: { id: placementId }, include: { person: true } })
  if (!p || p.person.deletedAt) throw notFound('Placement')
  await lockRow(tx, 'ccg_people', p.personId)
  const fresh = await tx.ccgPlacement.findUnique({ where: { id: placementId } })
  if (!fresh || !allowed.includes(fresh.status)) {
    throw conflict(`This placement is ${fresh?.status ?? 'gone'}; it can no longer be changed that way.`)
  }
  return { ...fresh, person: p.person }
}

/** `notify: false` leaves texting the CCF Coordinator to the caller (bulk approval sends one summary). */
export async function approvePlacement(
  placementId: string,
  actorId: string,
  opts: { notify?: boolean } = {}
) {
  const placed = await ccgTx(async (tx) => {
    const p = await openPlacement(tx, placementId, ['proposed'])
    const ccfId = p.proposedCcfId!
    await checkSeat(tx, ccfId, p.person)
    const updated = await tx.ccgPlacement.update({
      where: { id: p.id },
      data: {
        status: 'active',
        decision: 'approved',
        finalCcfId: ccfId,
        finalScore: p.proposedScore,
        decidedBy: actorId,
        decidedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    await tx.ccgPerson.update({ where: { id: p.personId }, data: { status: 'placed', updatedAt: new Date() } })
    await logCcg(
      { userId: actorId, action: 'PLACEMENT_APPROVED', entityType: 'ccg_placement', entityId: p.id, newValues: { ccf_id: ccfId } },
      tx
    )
    // Attendance is kept per person: a re-placed convert keeps their count.
    await syncAutoMilestones([p.id], tx)
    return updated
  })
  await graduateIfComplete([placed.id], actorId)
  if (opts.notify !== false) queueNewConvertSms([{ ccfId: placed.finalCcfId!, placementId: placed.id }], actorId, 'placed')
  return placed
}

/**
 * A CCF's leader registered this convert into their own CCF: placed there at
 * once, with no proposal to approve, and past the convert limit (user,
 * 2026-09-27: the limit is for converts placed by others). From here they follow milestones like any placed convert.
 */
export async function placeDirectly(personId: string, ccfId: string, actorId: string) {
  const placed = await ccgTx(async (tx) => {
    await lockRow(tx, 'ccg_people', personId)
    const person = await tx.ccgPerson.findFirst({ where: { id: personId, deletedAt: null } })
    if (!person || person.kind !== 'convert') throw notFound('Convert')
    await checkSeat(tx, ccfId, person, { ignoreConvertLimit: true })
    // Anything the matcher proposed meanwhile gives way.
    await tx.ccgPlacement.updateMany({ where: { personId, status: { in: ['proposed', 'held'] } }, data: { status: 'superseded', updatedAt: new Date() } })
    const created = await tx.ccgPlacement.create({
      data: {
        personId,
        proposedCcfId: ccfId,
        finalCcfId: ccfId,
        status: 'active',
        decision: 'approved',
        decidedBy: actorId,
        decidedAt: new Date(),
      },
    })
    await tx.ccgPerson.update({ where: { id: personId }, data: { status: 'placed', updatedAt: new Date() } })
    await logCcg(
      { userId: actorId, action: 'PLACEMENT_APPROVED', entityType: 'ccg_placement', entityId: created.id, newValues: { ccf_id: ccfId, registered_by_ccf: true } },
      tx
    )
    await syncAutoMilestones([created.id], tx)
    return created
  })
  await graduateIfComplete([placed.id], actorId)
  return placed
}

export async function remapPlacement(placementId: string, ccfId: string, reason: string, actorId: string) {
  const why = reason.trim()
  if (!why) throw invalid('Give a reason for remapping')
  const placed = await ccgTx(async (tx) => {
    const p = await openPlacement(tx, placementId, ['proposed', 'held'])
    await checkSeat(tx, ccfId, p.person)
    const updated = await tx.ccgPlacement.update({
      where: { id: p.id },
      data: {
        status: 'active',
        decision: 'remapped',
        finalCcfId: ccfId,
        finalScore: await scoreFromRun(tx, p.matchRunId, ccfId),
        overrideReason: why,
        holdReason: null,
        decidedBy: actorId,
        decidedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    await tx.ccgPerson.update({ where: { id: p.personId }, data: { status: 'placed', updatedAt: new Date() } })
    await logCcg(
      {
        userId: actorId,
        action: 'PLACEMENT_REMAPPED',
        entityType: 'ccg_placement',
        entityId: p.id,
        oldValues: { proposed_ccf_id: p.proposedCcfId },
        newValues: { ccf_id: ccfId, reason: why },
      },
      tx
    )
    await syncAutoMilestones([p.id], tx)
    return updated
  })
  await graduateIfComplete([placed.id], actorId)
  queueNewConvertSms([{ ccfId, placementId: placed.id }], actorId, 'placed')
  return placed
}

export async function holdPlacement(placementId: string, reason: string, actorId: string) {
  const why = reason.trim()
  if (!why) throw invalid('Say what is needed before this can be placed')
  return ccgTx(async (tx) => {
    const p = await openPlacement(tx, placementId, ['proposed'])
    const updated = await tx.ccgPlacement.update({
      where: { id: p.id },
      data: { status: 'held', holdReason: why, decidedBy: actorId, decidedAt: new Date(), updatedAt: new Date() },
    })
    await tx.ccgPerson.update({ where: { id: p.personId }, data: { status: 'needs_info', updatedAt: new Date() } })
    await logCcg({ userId: actorId, action: 'PLACEMENT_HELD', entityType: 'ccg_placement', entityId: p.id, newValues: { reason: why } }, tx)
    return updated
  })
}

export interface BulkResult {
  id: string
  ok: boolean
  error?: string
  code?: string
}

/** Approve many proposals; each succeeds or fails on its own. */
export async function bulkApprove(ids: string[], actorId: string, canApprove: (ccfId: string | null) => boolean): Promise<BulkResult[]> {
  const results: BulkResult[] = []
  const placed: Array<{ ccfId: string; placementId: string }> = []
  for (const id of ids) {
    try {
      const p = await prisma.ccgPlacement.findUnique({ where: { id }, select: { proposedCcfId: true } })
      if (!p) throw notFound('Placement')
      if (!canApprove(p.proposedCcfId)) throw new CcgError('forbidden', 'Not allowed for this CCF')
      const approved = await approvePlacement(id, actorId, { notify: false })
      placed.push({ ccfId: approved.finalCcfId!, placementId: approved.id })
      results.push({ id, ok: true })
    } catch (err) {
      results.push({
        id,
        ok: false,
        error: err instanceof Error ? err.message : 'Failed',
        code: err instanceof CcgError ? err.code : 'internal',
      })
    }
  }
  // One text per CCF Coordinator for the whole batch.
  queueNewConvertSms(placed, actorId, 'placed')
  return results
}

/** Re-propose every convert still waiting (or the given people). */
/** Re-match waiting converts; `streamIds` limits it to converts registered in those streams. */
export async function rescore(actorId: string, personIds?: string[], streamIds?: string[]) {
  const waiting = await prisma.ccgPerson.findMany({
    where: {
      kind: 'convert',
      deletedAt: null,
      status: { in: [...PROPOSABLE_STATUSES] },
      ...(personIds ? { id: { in: personIds } } : {}),
      ...(streamIds ? { streamId: { in: streamIds } } : {}),
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  let proposed = 0
  let held = 0
  for (const w of waiting) {
    const r = await proposeFor(w.id, 'rescore', actorId)
    if (r?.placement.status === 'proposed') proposed++
    else if (r) held++
  }
  return { rescored: waiting.length, proposed, held }
}

export async function endPlacement(placementId: string, reason: string, reopen: boolean, actorId: string) {
  const why = reason.trim()
  if (!why) throw invalid('Give a reason for ending this placement')
  const ended = await ccgTx(async (tx) => {
    const p = await openPlacement(tx, placementId, ['active'])
    await tx.ccgPlacement.update({
      where: { id: p.id },
      data: { status: 'ended', outcome: 'ended', endedAt: new Date(), endReason: why, updatedAt: new Date() },
    })
    await tx.ccgPerson.update({
      where: { id: p.personId },
      data: { status: reopen ? 'new' : 'inactive', updatedAt: new Date() },
    })
    await logCcg({ userId: actorId, action: 'PLACEMENT_ENDED', entityType: 'ccg_placement', entityId: p.id, newValues: { reason: why, reopen } }, tx)
    return p
  })
  if (reopen) await proposeFor(ended.personId, 'manual', actorId)
  return ended
}

export async function markIntegrated(placementId: string, actorId: string) {
  return ccgTx(async (tx) => {
    const p = await openPlacement(tx, placementId, ['active'])
    await tx.ccgPerson.update({ where: { id: p.personId }, data: { status: 'integrated', updatedAt: new Date() } })
    await logCcg({ userId: actorId, action: 'CONVERT_INTEGRATED', entityType: 'ccg_placement', entityId: p.id }, tx)
    return p
  })
}

/** The convert joins the CCF as a member and starts shaping its profile. */
export async function makeMember(placementId: string, actorId: string) {
  return ccgTx(async (tx) => {
    const p = await openPlacement(tx, placementId, ['active'])
    await tx.ccgPlacement.update({
      where: { id: p.id },
      data: { status: 'ended', outcome: 'made_member', endedAt: new Date(), endReason: 'Became a member of the CCF', updatedAt: new Date() },
    })
    await tx.ccgPerson.update({
      where: { id: p.personId },
      data: { kind: 'member', status: 'active', ccfId: p.finalCcfId, updatedAt: new Date() },
    })
    await logCcg({ userId: actorId, action: 'CONVERT_BECAME_MEMBER', entityType: 'ccg_person', entityId: p.personId, newValues: { ccf_id: p.finalCcfId } }, tx)
    return p
  })
}

/**
 * Transfer a member or a placed convert to another CCF (the smallest unit
 * anyone belongs to; moving to another CCG means choosing one of its CCFs).
 * The target CCF is locked and checked like an approval. A placed convert
 * keeps their placement, milestone progress and assessment clock; if the new
 * CCF is in another stream, the convert moves to that stream too. Every move
 * is recorded in ccg_transfers.
 */
export async function transferPerson(personId: string, toCcfId: string, reason: string, actorId: string) {
  const why = reason.trim()
  if (!why) throw invalid('Give a reason for the transfer')
  const t = await ccgTx(async (tx) => {
    await lockRow(tx, 'ccg_people', personId)
    const person = await tx.ccgPerson.findFirst({
      where: { id: personId, deletedAt: null },
      include: { placements: { where: { status: { in: ['active', 'proposed', 'held'] } } } },
    })
    if (!person) throw notFound('Person')

    const active = person.placements.find((p) => p.status === 'active') ?? null
    let fromCcfId: string | null
    if (person.kind === 'member') {
      if (!['active', 'pending'].includes(person.status)) throw conflict(`This member is ${person.status}`)
      fromCcfId = person.ccfId
    } else {
      if (!active) {
        throw conflict(
          person.placements.length
            ? 'This convert is still awaiting placement: use Place elsewhere on the approvals screen'
            : 'This convert has no placement to transfer'
        )
      }
      fromCcfId = active.finalCcfId
    }
    if (fromCcfId === toCcfId) throw invalid('They are already in this CCF')

    await checkSeat(tx, toCcfId, person)
    const target = await tx.ccgFamily.findUniqueOrThrow({ where: { id: toCcfId }, include: { ccg: true } })

    if (person.kind === 'member') {
      await tx.ccgPerson.update({ where: { id: person.id }, data: { ccfId: toCcfId, updatedAt: new Date() } })
    } else {
      await tx.ccgPlacement.update({ where: { id: active!.id }, data: { finalCcfId: toCcfId, updatedAt: new Date() } })
      const toStream = target.ccg.streamId
      if (person.streamId && toStream !== person.streamId) {
        await tx.ccgPerson.update({ where: { id: person.id }, data: { streamId: toStream, updatedAt: new Date() } })
      }
    }
    const t = await tx.ccgTransfer.create({
      data: {
        personId: person.id,
        kind: person.kind,
        placementId: active?.id ?? null,
        fromCcfId,
        toCcfId,
        reason: why,
        transferredBy: actorId,
      },
    })
    await logCcg(
      {
        userId: actorId,
        action: person.kind === 'member' ? 'MEMBER_TRANSFERRED' : 'CONVERT_TRANSFERRED',
        entityType: 'ccg_person',
        entityId: person.id,
        oldValues: { ccf_id: fromCcfId },
        newValues: { ccf_id: toCcfId, reason: why },
      },
      tx
    )
    return t
  })
  if (t.kind === 'convert' && t.placementId) queueNewConvertSms([{ ccfId: toCcfId, placementId: t.placementId }], actorId, 'transferred')
  return t
}

/**
 * Close a CCF and move everyone in it to another CCF in one step: members
 * first (so the receiving CCF's convert limit grows with them), then placed
 * converts, who keep their placement, milestones and assessment year, as in a
 * transfer. Converts still waiting for approval into it are matched again.
 * Its roles end, its form links stop working and it is closed down, as when
 * an empty CCF is deleted. All or nothing: if the receiving CCF can't take
 * the converts, nothing moves.
 */
export async function closeCcf(ccfId: string, toCcfId: string | null, actorId: string) {
  if (toCcfId === ccfId) throw invalid('Choose a different CCF to move everyone to')
  const out = await ccgTx(async (tx) => {
    // Lock both CCFs in a fixed order so two closes can't deadlock.
    for (const id of [ccfId, toCcfId].filter((x): x is string => !!x).sort()) await lockRow(tx, 'ccg_families', id)
    const from = await tx.ccgFamily.findFirst({ where: { id: ccfId, deletedAt: null }, include: { ccg: true } })
    if (!from) throw notFound('CCF')

    const people = await tx.ccgPerson.findMany({ where: { ccfId, deletedAt: null }, select: { id: true, kind: true, status: true } })
    const placed = await tx.ccgPlacement.findMany({
      where: { status: 'active', finalCcfId: ccfId, person: { deletedAt: null } },
      select: { id: true, personId: true, person: { select: { streamId: true } } },
    })
    const waiting = await tx.ccgPlacement.findMany({
      where: { status: 'proposed', proposedCcfId: ccfId, person: { deletedAt: null } },
      select: { personId: true },
    })

    let to: { id: string; name: string; streamId: string | null } | null = null
    if (people.length || placed.length) {
      if (!toCcfId) throw invalid(`Choose a CCF to move ${from.name}'s people to`)
      const target = await tx.ccgFamily.findFirst({ where: { id: toCcfId, deletedAt: null }, include: { ccg: true } })
      if (!target || target.ccg.deletedAt) throw notFound('CCF to move to')
      if (target.status !== 'active' || target.ccg.status !== 'active') throw conflict(`${target.name} or its CCG is not active. Choose another CCF.`)
      to = { id: target.id, name: target.name, streamId: target.ccg.streamId }

      const [targetMembers, targetConverts] = await Promise.all([
        tx.ccgPerson.count({ where: { kind: 'member', status: 'active', deletedAt: null, ccfId: target.id } }),
        tx.ccgPlacement.count({ where: { status: 'active', finalCcfId: target.id, person: { deletedAt: null } } }),
      ])
      const movingMembers = people.filter((p) => p.kind === 'member' && p.status === 'active').length
      const limit = convertLimitFor(targetMembers + movingMembers)
      if (targetConverts + placed.length > limit) {
        throw conflict(
          `With ${from.name}'s members, ${target.name} can hold ${limit} convert${limit === 1 ? '' : 's'}. It has ${targetConverts} and ${from.name} has ${placed.length}. ` +
            'Choose a bigger CCF, or transfer some converts elsewhere first.',
          { reason: 'convert_limit' }
        )
      }
    }

    const why = `Moved when ${from.name} closed down`
    if (to) {
      const target = to
      await tx.ccgPerson.updateMany({ where: { ccfId, deletedAt: null }, data: { ccfId: target.id, updatedAt: new Date() } })
      if (placed.length) {
        await tx.ccgPlacement.updateMany({ where: { id: { in: placed.map((p) => p.id) } }, data: { finalCcfId: target.id, updatedAt: new Date() } })
        // A convert follows their CCF into its stream.
        const otherStream = placed.filter((p) => p.person.streamId && p.person.streamId !== target.streamId).map((p) => p.personId)
        if (otherStream.length) await tx.ccgPerson.updateMany({ where: { id: { in: otherStream } }, data: { streamId: target.streamId, updatedAt: new Date() } })
      }
      const convertIds = new Set(placed.map((p) => p.personId))
      await tx.ccgTransfer.createMany({
        data: [
          ...people
            .filter((p) => p.kind === 'member' && !convertIds.has(p.id))
            .map((p) => ({ personId: p.id, kind: 'member', placementId: null, fromCcfId: ccfId, toCcfId: target.id, reason: why, transferredBy: actorId })),
          ...placed.map((p) => ({ personId: p.personId, kind: 'convert', placementId: p.id, fromCcfId: ccfId, toCcfId: target.id, reason: why, transferredBy: actorId })),
        ],
      })
    }

    await tx.ccgRoleAssignment.updateMany({ where: { ccfId, endsOn: null }, data: { endsOn: new Date() } })
    await tx.ccgFormLink.updateMany({ where: { ccfId, revokedAt: null }, data: { revokedAt: new Date() } })
    await tx.ccgFamily.update({ where: { id: ccfId }, data: { deletedAt: new Date(), status: 'inactive', updatedAt: new Date() } })
    const moved = { members: people.filter((p) => p.kind === 'member').length, converts: placed.length, rematched: waiting.length }
    await logCcg(
      { userId: actorId, action: 'CCF_DELETED', entityType: 'ccg_family', entityId: ccfId, newValues: { moved_to_ccf_id: to?.id ?? null, ...moved } },
      tx
    )
    return { to, moved, placed, waiting: waiting.map((w) => w.personId) }
  })

  if (out.waiting.length) await rescore(actorId, out.waiting)
  if (out.to && out.placed.length) {
    const toId = out.to.id
    queueNewConvertSms(out.placed.map((p) => ({ ccfId: toId, placementId: p.id })), actorId, 'transferred')
  }
  return { to: out.to, ...out.moved }
}
