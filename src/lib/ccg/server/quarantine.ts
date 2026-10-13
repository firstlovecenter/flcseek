import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { conflict, forbidden, invalid, notFound } from '../errors'
import type { CcgScope } from '../scope'
import { ccgTx, iso, logCcg, userRefs } from './common'
import { lockRow, proposeFor } from './mapping'
import { checkSeat } from './placements'

/**
 * Quarantine: converts who already belong to a Bacenta, so don't qualify for a
 * CCF (some have been placed in one anyway).
 *
 *   quarantine  by the convert's CCF Coordinator, the leaders and admins above
 *               (people.manage on the CCF), or a Sheep Seeking role
 *               (people.manage on the stream). A placed convert leaves the CCF at
 *               once: the placement becomes 'quarantined', keeping its progress.
 *               A convert not yet placed has their proposal set aside.
 *   decide      by the stream's or campus's Sheep Seeking Admin (seekers.manage):
 *     confirm   belongs to a Bacenta: placement ends (outcome 'bacenta'), status 'bacenta'
 *     release   back to the same CCF with their progress (or back to matching)
 *     replace   matched afresh for another CCF, as a new convert is
 *
 * No one is notified.
 */

export type QuarantineDecision = 'confirm' | 'release' | 'replace'
export type QuarantineStatus = 'open' | 'confirmed' | 'released' | 'replaced'

/** Convert statuses that can be quarantined: placed or waiting to be. */
const QUARANTINABLE = ['new', 'proposed', 'needs_info', 'placed', 'integrated']

/** May this viewer quarantine this convert? */
export async function canQuarantine(scope: CcgScope, personId: string) {
  const p = await prisma.ccgPerson.findFirst({
    where: { id: personId, kind: 'convert', deletedAt: null },
    select: { streamId: true, status: true, placements: { where: { status: 'active' }, select: { finalCcfId: true, finalCcf: { select: { ccg: { select: { streamId: true } } } } } } },
  })
  if (!p) return false
  return allowedToFlag(scope, p.streamId, p.placements[0]?.finalCcfId ?? null, p.placements[0]?.finalCcf?.ccg.streamId ?? null)
}

function allowedToFlag(scope: CcgScope, streamId: string | null, ccfId: string | null, ccfStreamId: string | null) {
  if (scope.can('people.manage')) return true
  // The CCF's leaders and admins (City Church Groups side)...
  if (ccfId && scope.leadership().canOnCcf('people.manage', ccfId)) return true
  // ...or the stream's Sheep Seeking roles.
  const seeking = scope.sheepSeeking()
  return [streamId, ccfStreamId].some((s) => !!s && seeking.canOnStream('people.manage', s))
}

export async function quarantineConvert(scope: CcgScope, personId: string, reason: string, actorId: string) {
  const why = reason.trim()
  if (!why) throw invalid('Say why (for example, which Bacenta they belong to)', { reason: 'Required' })
  const out = await ccgTx(async (tx) => {
    await lockRow(tx, 'ccg_people', personId)
    const p = await tx.ccgPerson.findFirst({
      where: { id: personId, deletedAt: null },
      include: {
        placements: {
          where: { status: { in: ['proposed', 'held', 'active'] } },
          include: { finalCcf: { select: { id: true, ccg: { select: { streamId: true } } } } },
        },
      },
    })
    if (!p || p.kind !== 'convert') throw notFound('Convert')
    if (p.status === 'quarantined') throw conflict(`${p.fullName} is already in quarantine.`)
    if (!QUARANTINABLE.includes(p.status)) throw conflict(`${p.fullName} can’t be quarantined now (they are ${p.status}).`)
    const active = p.placements.find((x) => x.status === 'active') ?? null
    if (!allowedToFlag(scope, p.streamId, active?.finalCcfId ?? null, active?.finalCcf?.ccg.streamId ?? null)) {
      throw forbidden('Only the convert’s CCF leaders, the admins above them or the stream’s Sheep Seeking team can quarantine them')
    }

    const now = new Date()
    // Off the CCF at once (a placed convert keeps their progress on the placement); proposals set aside.
    if (active) await tx.ccgPlacement.update({ where: { id: active.id }, data: { status: 'quarantined', updatedAt: now } })
    await tx.ccgPlacement.updateMany({ where: { personId, status: { in: ['proposed', 'held'] } }, data: { status: 'superseded', updatedAt: now } })
    await tx.ccgPerson.update({ where: { id: personId }, data: { status: 'quarantined', updatedAt: now } })
    const q = await tx.ccgQuarantine.create({
      data: {
        personId,
        placementId: active?.id ?? null,
        ccfId: active?.finalCcfId ?? null,
        streamId: p.streamId ?? active?.finalCcf?.ccg.streamId ?? null,
        priorStatus: p.status,
        reason: why,
        flaggedBy: actorId,
      },
    })
    await logCcg(
      { userId: actorId, action: 'CONVERT_QUARANTINED', entityType: 'ccg_person', entityId: personId, newValues: { reason: why, ccf_id: q.ccfId, placement_id: q.placementId } },
      tx
    )
    return q
  })
  return { quarantine: out }
}

/** Streams whose quarantine the viewer sees and decides: their Sheep Seeking Admin's (or the campus's), or all. */
function decidingStreams(scope: CcgScope) {
  return scope.sheepSeeking().streamIds('seekers.manage')
}

export async function listQuarantines(
  scope: CcgScope,
  f: { status: QuarantineStatus[]; streamId?: string | null; campusId?: string | null; limit: number; offset: number }
) {
  const streams = decidingStreams(scope)
  if (streams !== 'all' && streams.length === 0) throw forbidden('Quarantine is for Sheep Seeking Admins')
  if (f.streamId && streams !== 'all' && !streams.includes(f.streamId)) throw forbidden('You can only see your streams’ quarantine')
  const where: Prisma.CcgQuarantineWhereInput = {
    status: { in: f.status },
    person: { deletedAt: null },
    AND: [
      streams === 'all' ? {} : { streamId: { in: streams } },
      f.streamId ? { streamId: f.streamId } : {},
      f.campusId ? { stream: { campusId: f.campusId } } : {},
    ],
  }
  const [rows, total, open] = await Promise.all([
    prisma.ccgQuarantine.findMany({
      where,
      orderBy: f.status.includes('open') ? { flaggedAt: 'asc' } : { decidedAt: 'desc' },
      take: f.limit,
      skip: f.offset,
      include: {
        person: { select: { id: true, fullName: true, phone: true, refCode: true } },
        ccf: { select: { id: true, name: true, ccg: { select: { id: true, name: true } } } },
        stream: { select: { id: true, name: true } },
      },
    }),
    prisma.ccgQuarantine.count({ where }),
    prisma.ccgQuarantine.count({ where: { ...where, status: 'open' } }),
  ])
  const users = await userRefs(rows.flatMap((r) => [r.flaggedBy, r.decidedBy]))
  return {
    quarantines: rows.map((r) => ({
      id: r.id,
      status: r.status,
      person: { id: r.person.id, full_name: r.person.fullName, phone: r.person.phone, ref_code: r.person.refCode },
      /** The CCF they left (null if they had not been placed). */
      ccf: r.ccf ? { id: r.ccf.id, name: r.ccf.name, ccg: r.ccf.ccg } : null,
      stream: r.stream,
      reason: r.reason,
      flagged_by: r.flaggedBy ? users.get(r.flaggedBy) ?? null : null,
      flagged_at: iso(r.flaggedAt),
      decided_by: r.decidedBy ? users.get(r.decidedBy) ?? null : null,
      decided_at: iso(r.decidedAt),
      decision_note: r.decisionNote,
    })),
    total,
    open,
  }
}

const DECIDED: Record<QuarantineDecision, QuarantineStatus> = { confirm: 'confirmed', release: 'released', replace: 'replaced' }

export async function decideQuarantine(scope: CcgScope, id: string, decision: QuarantineDecision, note: string | null, actorId: string) {
  let rematch: string | null = null
  const out = await ccgTx(async (tx) => {
    const q0 = await tx.ccgQuarantine.findUnique({ where: { id } })
    if (!q0) throw notFound('Quarantine')
    await lockRow(tx, 'ccg_people', q0.personId)
    const q = await tx.ccgQuarantine.findUniqueOrThrow({ where: { id } })
    const streams = decidingStreams(scope)
    if (streams !== 'all' && !(q.streamId && streams.includes(q.streamId))) {
      throw forbidden('Only the stream’s or campus’s Sheep Seeking Admin decides this')
    }
    if (q.status !== 'open') throw conflict('This case has already been decided.')
    const person = await tx.ccgPerson.findUniqueOrThrow({ where: { id: q.personId } })
    const placement = q.placementId ? await tx.ccgPlacement.findUnique({ where: { id: q.placementId } }) : null
    const held = placement?.status === 'quarantined' ? placement : null
    const now = new Date()

    if (decision === 'confirm') {
      if (held) {
        await tx.ccgPlacement.update({
          where: { id: held.id },
          data: { status: 'ended', outcome: 'bacenta', endedAt: now, endReason: 'Belongs to a Bacenta', updatedAt: now },
        })
      }
      await tx.ccgPerson.update({ where: { id: person.id }, data: { status: 'bacenta', updatedAt: now } })
    } else if (decision === 'release' && held?.finalCcfId) {
      // Back to the same CCF, if it still has room (the convert limit has no exceptions).
      await checkSeat(tx, held.finalCcfId, person)
      await tx.ccgPlacement.update({ where: { id: held.id }, data: { status: 'active', updatedAt: now } })
      await tx.ccgPerson.update({ where: { id: person.id }, data: { status: q.priorStatus === 'integrated' ? 'integrated' : 'placed', updatedAt: now } })
    } else {
      // Release of a convert who was not placed, or a new placement: matched afresh.
      if (held) await tx.ccgPlacement.update({ where: { id: held.id }, data: { status: 'superseded', updatedAt: now } })
      await tx.ccgPerson.update({ where: { id: person.id }, data: { status: 'new', updatedAt: now } })
      rematch = person.id
    }

    const done = await tx.ccgQuarantine.update({
      where: { id },
      data: { status: DECIDED[decision], decidedBy: actorId, decidedAt: now, decisionNote: note?.trim() || null },
    })
    await logCcg(
      { userId: actorId, action: `QUARANTINE_${DECIDED[decision].toUpperCase()}`, entityType: 'ccg_person', entityId: person.id, newValues: { quarantine_id: id, note } },
      tx
    )
    return done
  })
  const proposal = rematch ? await proposeFor(rematch, 'manual', actorId) : null
  return { quarantine: out, proposal: proposal ? { id: proposal.placement.id, status: proposal.placement.status } : null }
}
