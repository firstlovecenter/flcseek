import { prisma } from '@/lib/prisma'
import { CcgError, conflict, invalid, notFound } from '../errors'
import { ccgTx, getCcgConfig, logCcg, type Tx } from './common'
import { lockRow, proposeFor, PROPOSABLE_STATUSES, type StoredMatchResults } from './mapping'
import { graduateIfComplete } from './graduation'
import { syncAutoMilestones } from './progress'

/**
 * Placement lifecycle. Every decision re-checks the CCF under a row lock, so
 * two approvals racing for a CCF's last seat cannot both succeed.
 *
 *   proposed ──approve──▶ active ──end──▶ ended
 *      │  └──remap (reason)──▶ active
 *      └──hold──▶ held ──remap──▶ active
 *   (proposed | held) ──new proposal──▶ superseded
 */

async function occupancy(tx: Tx, ccfId: string): Promise<number> {
  const [members, placed] = await Promise.all([
    tx.ccgPerson.count({ where: { kind: 'member', status: 'active', deletedAt: null, ccfId } }),
    tx.ccgPlacement.count({ where: { status: 'active', finalCcfId: ccfId, person: { deletedAt: null } } }),
  ])
  return members + placed
}

/** Lock the CCF and check it can take one more person. Returns whether it overfills. */
async function checkSeat(
  tx: Tx,
  ccfId: string,
  person: { dateOfBirth: Date | null },
  overrideReason: string | null
): Promise<{ full: boolean }> {
  await lockRow(tx, 'ccg_families', ccfId)
  const unit = await tx.ccgFamily.findUnique({ where: { id: ccfId }, include: { ccg: true } })
  if (!unit || unit.deletedAt || unit.ccg.deletedAt) throw notFound('CCF')
  if (unit.status !== 'active' || unit.ccg.status !== 'active') {
    throw conflict(`${unit.name} or its CCG is no longer active. Rescore to propose another CCF.`)
  }

  const full = (await occupancy(tx, ccfId)) >= unit.capacity
  if (full) {
    const config = await getCcgConfig(tx)
    if (!config.allowFullOverride) {
      throw conflict(`${unit.name} is now full. Rescore to propose another CCF.`, { reason: 'ccf_full' })
    }
    if (!overrideReason) throw invalid(`${unit.name} is full. Give a reason to place over capacity.`)
  }
  return { full }
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

export async function approvePlacement(placementId: string, actorId: string, overrideReason?: string | null) {
  const reason = overrideReason?.trim() || null
  const placed = await ccgTx(async (tx) => {
    const p = await openPlacement(tx, placementId, ['proposed'])
    const ccfId = p.proposedCcfId!
    const { full } = await checkSeat(tx, ccfId, p.person, reason)
    const updated = await tx.ccgPlacement.update({
      where: { id: p.id },
      data: {
        status: 'active',
        decision: 'approved',
        finalCcfId: ccfId,
        finalScore: p.proposedScore,
        fullCcfOverride: full,
        overrideReason: full ? reason : null,
        decidedBy: actorId,
        decidedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    await tx.ccgPerson.update({ where: { id: p.personId }, data: { status: 'placed', updatedAt: new Date() } })
    await logCcg(
      { userId: actorId, action: 'PLACEMENT_APPROVED', entityType: 'ccg_placement', entityId: p.id, newValues: { ccf_id: ccfId, full_ccf_override: full } },
      tx
    )
    // Attendance is kept per person: a re-placed convert keeps their count.
    await syncAutoMilestones([p.id], tx)
    return updated
  })
  await graduateIfComplete([placed.id], actorId)
  return placed
}

export async function remapPlacement(placementId: string, ccfId: string, reason: string, actorId: string) {
  const why = reason.trim()
  if (!why) throw invalid('Give a reason for remapping')
  const placed = await ccgTx(async (tx) => {
    const p = await openPlacement(tx, placementId, ['proposed', 'held'])
    const { full } = await checkSeat(tx, ccfId, p.person, why)
    const updated = await tx.ccgPlacement.update({
      where: { id: p.id },
      data: {
        status: 'active',
        decision: 'remapped',
        finalCcfId: ccfId,
        finalScore: await scoreFromRun(tx, p.matchRunId, ccfId),
        overrideReason: why,
        fullCcfOverride: full,
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
        newValues: { ccf_id: ccfId, reason: why, full_ccf_override: full },
      },
      tx
    )
    await syncAutoMilestones([p.id], tx)
    return updated
  })
  await graduateIfComplete([placed.id], actorId)
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
  for (const id of ids) {
    try {
      const p = await prisma.ccgPlacement.findUnique({ where: { id }, select: { proposedCcfId: true } })
      if (!p) throw notFound('Placement')
      if (!canApprove(p.proposedCcfId)) throw new CcgError('forbidden', 'Not allowed for this CCF')
      await approvePlacement(id, actorId)
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
  return ccgTx(async (tx) => {
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

    const { full } = await checkSeat(tx, toCcfId, person, why)
    const target = await tx.ccgFamily.findUniqueOrThrow({ where: { id: toCcfId }, include: { ccg: { include: { council: true } } } })

    if (person.kind === 'member') {
      await tx.ccgPerson.update({ where: { id: person.id }, data: { ccfId: toCcfId, updatedAt: new Date() } })
    } else {
      await tx.ccgPlacement.update({ where: { id: active!.id }, data: { finalCcfId: toCcfId, updatedAt: new Date() } })
      const toStream = target.ccg.council?.streamId ?? null
      if (person.streamId && toStream && toStream !== person.streamId) {
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
        overCapacity: full,
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
        newValues: { ccf_id: toCcfId, reason: why, over_capacity: full },
      },
      tx
    )
    return t
  })
}
