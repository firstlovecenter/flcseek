import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere } from '../access'
import { conflict, invalid, notFound } from '../errors'
import { convertLimitFor } from '../engine/profile'
import type { CcgScope } from '../scope'
import { ccgTx, dateOnly, logCcg } from './common'
import { ensure } from './handler'
import { lockRow } from './mapping'
import { queueNewConvertSms } from './notify'
import { rescore } from './placements'
import { LEADER_ROLE, assignRoleToMember } from './roles'

/**
 * Closing a CCF down. Everyone in it moves somewhere: each member and placed
 * convert to the CCF chosen for them (or the one chosen for everyone). Placed
 * converts keep their placement, milestones and assessment year, as in a
 * transfer. Converts waiting for approval or on hold for it are matched again;
 * move requests into it are cancelled, and those out of it pass to the
 * person's new CCF. Its roles end (its coordinators may become coordinators of
 * the CCF they move to), its form links stop working, and it is closed.
 * Members are never notified; the receiving coordinators are texted about
 * the converts, as for any convert placed with them.
 *
 * All or nothing: if any receiving CCF can't take the converts sent to it,
 * nothing moves.
 *
 * Who: the central team, and the Sheep Seeking Admin of the CCF's stream or
 * its campus (people may be sent to CCFs of the streams they run).
 */

type CcfRef = { id: string; name: string; status: string; meetingDay: string | null; meetingTime: string | null; ccg: { id: string; name: string; streamId: string; status: string; deletedAt: Date | null; stream: { name: string } } }

const ccfSelect = {
  id: true,
  name: true,
  status: true,
  meetingDay: true,
  meetingTime: true,
  ccg: { select: { id: true, name: true, streamId: true, status: true, deletedAt: true, stream: { select: { name: true } } } },
} as const

/** Close it, or send people to it: church-wide, or sheep seeking run in its stream (stream or campus). */
export const mayCloseIn = (scope: CcgScope, streamId: string) => scope.can('structure.manage') || scope.sheepSeeking().canOnStream('seekers.manage', streamId)

async function loadClosing(ccfId: string) {
  const ccf = await prisma.ccgFamily.findFirst({ where: { id: ccfId, deletedAt: null }, select: ccfSelect })
  if (!ccf) throw notFound('CCF')
  return ccf
}

/** Room in each CCF: active members and placed converts now. */
async function roomIn(ccfIds: string[]) {
  const [members, converts] = await Promise.all([
    prisma.ccgPerson.groupBy({ by: ['ccfId'], where: { kind: 'member', status: 'active', deletedAt: null, ccfId: { in: ccfIds } }, _count: { _all: true } }),
    prisma.ccgPlacement.groupBy({ by: ['finalCcfId'], where: { status: 'active', finalCcfId: { in: ccfIds }, person: { deletedAt: null } }, _count: { _all: true } }),
  ])
  const m = new Map(members.map((r) => [r.ccfId!, r._count._all]))
  const c = new Map(converts.map((r) => [r.finalCcfId!, r._count._all]))
  return (id: string) => ({ members: m.get(id) ?? 0, converts: c.get(id) ?? 0 })
}

/**
 * What closing this CCF would move: its members (and which coordinate it),
 * its placed converts, those waiting for it, pending move requests, and the
 * CCFs the viewer may send people to, with their room.
 */
export async function closurePreview(scope: CcgScope, ccfId: string) {
  const ccf = await loadClosing(ccfId)
  ensure(mayCloseIn(scope, ccf.ccg.streamId), 'Only the central team, or the Sheep Seeking Admin of its stream or campus, closes a CCF')

  const [members, placed, waiting, held, moves, coordinators, candidates] = await Promise.all([
    prisma.ccgPerson.findMany({
      where: { ccfId, kind: 'member', deletedAt: null },
      select: { id: true, fullName: true, status: true, userId: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.ccgPlacement.findMany({
      where: { status: 'active', finalCcfId: ccfId, person: { deletedAt: null } },
      select: { id: true, decidedAt: true, person: { select: { id: true, fullName: true } } },
      orderBy: { person: { fullName: 'asc' } },
    }),
    prisma.ccgPlacement.count({ where: { status: 'proposed', proposedCcfId: ccfId, person: { deletedAt: null } } }),
    prisma.ccgPlacement.count({ where: { status: 'held', proposedCcfId: ccfId, person: { deletedAt: null } } }),
    prisma.ccgMoveRequest.count({ where: { status: 'pending', OR: [{ toCcfId: ccfId }, { fromCcfId: ccfId }] } }),
    prisma.ccgRoleAssignment.findMany({ where: { roleKey: LEADER_ROLE.ccf, ccfId, ...currentAssignmentWhere() }, select: { userId: true } }),
    prisma.ccgFamily.findMany({
      where: { id: { not: ccfId }, deletedAt: null, status: 'active', ccg: { deletedAt: null, status: 'active' } },
      select: ccfSelect,
      orderBy: { name: 'asc' },
    }),
  ])
  const allowed = candidates.filter((c) => mayCloseIn(scope, c.ccg.streamId))
  const room = await roomIn(allowed.map((c) => c.id))
  const coordinatorUsers = new Set(coordinators.map((c) => c.userId))

  return {
    ccf: { id: ccf.id, name: ccf.name, ccg: { id: ccf.ccg.id, name: ccf.ccg.name }, stream: { id: ccf.ccg.streamId, name: ccf.ccg.stream.name } },
    members: members.map((p) => ({
      person_id: p.id,
      name: p.fullName,
      status: p.status,
      is_coordinator: !!p.userId && coordinatorUsers.has(p.userId),
    })),
    converts: placed.map((p) => ({ person_id: p.person.id, placement_id: p.id, name: p.person.fullName, placed_on: dateOnly(p.decidedAt) })),
    /** Matched again when it closes. */
    waiting_for_approval: waiting,
    on_hold: held,
    /** Into it: cancelled. Out of it: passed to the person's new CCF. */
    pending_move_requests: moves,
    /** Where people may go: CCFs of the streams the viewer runs (every CCF for the central team). */
    destinations: allowed.map((c) => {
      const r = room(c.id)
      return {
        id: c.id,
        name: c.name,
        ccg: { id: c.ccg.id, name: c.ccg.name },
        stream: { id: c.ccg.streamId, name: c.ccg.stream.name },
        same_ccg: c.ccg.id === ccf.ccg.id,
        members: r.members,
        converts: r.converts,
        convert_limit: convertLimitFor(r.members),
      }
    }),
  }
}

export interface ClosePlan {
  /** Where everyone goes unless `moves` says otherwise (needed unless every person has a move). */
  to_ccf_id?: string | null
  /** person id → the CCF they go to. */
  moves?: Record<string, string>
  /** Its coordinators: just members of the CCF they go to, or also its coordinators. */
  coordinators?: 'member' | 'coordinator'
}

export async function closeCcf(scope: CcgScope, ccfId: string, plan: ClosePlan, actorId: string, origin: string) {
  const closing = await loadClosing(ccfId)
  ensure(mayCloseIn(scope, closing.ccg.streamId), 'Only the central team, or the Sheep Seeking Admin of its stream or campus, closes a CCF')
  const moves = plan.moves ?? {}
  const targetIds = [...new Set([...(plan.to_ccf_id ? [plan.to_ccf_id] : []), ...Object.values(moves)])]
  if (targetIds.includes(ccfId)) throw invalid('Choose other CCFs to move people to')

  const out = await ccgTx(async (tx) => {
    // Lock every CCF involved in a fixed order so two closes can't deadlock.
    for (const id of [ccfId, ...targetIds].sort()) await lockRow(tx, 'ccg_families', id)
    const from = await tx.ccgFamily.findFirst({ where: { id: ccfId, deletedAt: null }, select: ccfSelect })
    if (!from) throw notFound('CCF')

    const people = await tx.ccgPerson.findMany({ where: { ccfId, deletedAt: null }, select: { id: true, kind: true, status: true, fullName: true, userId: true } })
    const placed = await tx.ccgPlacement.findMany({
      where: { status: 'active', finalCcfId: ccfId, person: { deletedAt: null } },
      select: { id: true, personId: true, person: { select: { streamId: true, fullName: true } } },
    })
    const waiting = await tx.ccgPlacement.findMany({
      where: { status: { in: ['proposed', 'held'] }, proposedCcfId: ccfId, person: { deletedAt: null } },
      select: { personId: true },
    })
    const coordinators = await tx.ccgRoleAssignment.findMany({ where: { roleKey: LEADER_ROLE.ccf, ccfId, ...currentAssignmentWhere() }, select: { userId: true } })

    // Where each goes. A convert in the CCF is moved with their placement, never as a member.
    const convertIds = new Set(placed.map((p) => p.personId))
    const memberRows = people.filter((p) => p.kind === 'member' && !convertIds.has(p.id))
    const stray = Object.keys(moves).filter((id) => !convertIds.has(id) && !memberRows.some((p) => p.id === id))
    if (stray.length) throw invalid('Some of the people chosen are not in this CCF any more. Reload and try again.')
    const dest = (personId: string) => moves[personId] ?? plan.to_ccf_id ?? null
    const unplanned = [...memberRows.map((p) => ({ id: p.id, name: p.fullName })), ...placed.map((p) => ({ id: p.personId, name: p.person.fullName }))].filter((p) => !dest(p.id))
    if (unplanned.length) throw invalid(`Choose where ${unplanned.length === 1 ? unplanned[0].name : `${unplanned.length} people`} should go`)

    // Every CCF used must be open and one the closer may send people to.
    const used = [...new Set([...memberRows.map((p) => dest(p.id)!), ...placed.map((p) => dest(p.personId)!)])]
    const targets = new Map<string, CcfRef>()
    for (const id of used) {
      const t = await tx.ccgFamily.findFirst({ where: { id, deletedAt: null }, select: ccfSelect })
      if (!t || t.ccg.deletedAt) throw notFound('CCF to move people to')
      if (t.status !== 'active' || t.ccg.status !== 'active') throw conflict(`${t.name} or its CCG is not active. Choose another CCF.`)
      if (!mayCloseIn(scope, t.ccg.streamId)) throw conflict(`You can only move people to CCFs of the streams you run. ${t.name} is in ${t.ccg.stream.name}.`)
      targets.set(id, t)
    }

    // Room: each receiving CCF's limit grows with the active members it receives.
    const problems: string[] = []
    for (const [id, t] of targets) {
      const [members, converts] = await Promise.all([
        tx.ccgPerson.count({ where: { kind: 'member', status: 'active', deletedAt: null, ccfId: id } }),
        tx.ccgPlacement.count({ where: { status: 'active', finalCcfId: id, person: { deletedAt: null } } }),
      ])
      const inMembers = memberRows.filter((p) => p.status === 'active' && dest(p.id) === id).length
      const inConverts = placed.filter((p) => dest(p.personId) === id).length
      const limit = convertLimitFor(members + inMembers)
      if (converts + inConverts > limit) problems.push(`${t.name} can hold ${limit} convert${limit === 1 ? '' : 's'} with the members joining it; it has ${converts} and would get ${inConverts}`)
    }
    if (problems.length) throw conflict(`${problems.join('. ')}. Send some converts elsewhere.`, { reason: 'convert_limit' })

    const why = `Moved when ${from.name} closed down`
    for (const [id, t] of targets) {
      const memberIds = memberRows.filter((p) => dest(p.id) === id).map((p) => p.id)
      const here = placed.filter((p) => dest(p.personId) === id)
      if (memberIds.length) await tx.ccgPerson.updateMany({ where: { id: { in: memberIds } }, data: { ccfId: id, updatedAt: new Date() } })
      if (here.length) {
        await tx.ccgPlacement.updateMany({ where: { id: { in: here.map((p) => p.id) } }, data: { finalCcfId: id, updatedAt: new Date() } })
        // A convert follows their CCF into its stream.
        const otherStream = here.filter((p) => p.person.streamId && p.person.streamId !== t.ccg.streamId).map((p) => p.personId)
        if (otherStream.length) await tx.ccgPerson.updateMany({ where: { id: { in: otherStream } }, data: { streamId: t.ccg.streamId, updatedAt: new Date() } })
        // Converts with the closing CCF on their own record follow too.
        await tx.ccgPerson.updateMany({ where: { id: { in: here.map((p) => p.personId) }, ccfId }, data: { ccfId: id, updatedAt: new Date() } })
      }
      await tx.ccgTransfer.createMany({
        data: [
          ...memberIds.map((personId) => ({ personId, kind: 'member', placementId: null, fromCcfId: ccfId, toCcfId: id, reason: why, transferredBy: actorId })),
          ...here.map((p) => ({ personId: p.personId, kind: 'convert', placementId: p.id, fromCcfId: ccfId, toCcfId: id, reason: why, transferredBy: actorId })),
        ],
      })
    }

    // Anyone else still recorded in it (e.g. a convert whose placement ended) goes with the rest.
    const fallback = plan.to_ccf_id ?? targets.keys().next().value ?? null
    await tx.ccgPerson.updateMany({ where: { ccfId, deletedAt: null }, data: { ccfId: fallback, updatedAt: new Date() } })

    // Move requests: into a closed CCF can't happen; out of it, the person's new coordinator decides.
    await tx.ccgMoveRequest.updateMany({
      where: { status: 'pending', toCcfId: ccfId },
      data: { status: 'cancelled', declineReason: `${from.name} closed down`, decidedBy: actorId, decidedAt: new Date() },
    })
    const outOf = await tx.ccgMoveRequest.findMany({ where: { status: 'pending', fromCcfId: ccfId }, select: { id: true, personId: true, toCcfId: true } })
    for (const r of outOf) {
      const now = dest(r.personId)
      if (now === r.toCcfId) {
        await tx.ccgMoveRequest.update({ where: { id: r.id }, data: { status: 'approved', decidedBy: actorId, decidedAt: new Date() } })
      } else {
        await tx.ccgMoveRequest.update({ where: { id: r.id }, data: { fromCcfId: now } })
      }
    }

    await tx.ccgRoleAssignment.updateMany({ where: { ccfId, endsOn: null }, data: { endsOn: new Date() } })
    await tx.ccgFormLink.updateMany({ where: { ccfId, revokedAt: null }, data: { revokedAt: new Date() } })
    await tx.ccgFamily.update({ where: { id: ccfId }, data: { deletedAt: new Date(), status: 'inactive', updatedAt: new Date() } })
    const moved = { members: memberRows.length, converts: placed.length, rematched: waiting.length }
    await logCcg(
      {
        userId: actorId,
        action: 'CCF_DELETED',
        entityType: 'ccg_family',
        entityId: ccfId,
        newValues: { moved_to: Object.fromEntries([...targets.keys()].map((id) => [id, [...memberRows.map((p) => p.id), ...placed.map((p) => p.personId)].filter((p) => dest(p) === id).length])), ...moved },
      },
      tx
    )

    const coordinatorUsers = new Set(coordinators.map((c) => c.userId))
    return {
      from,
      targets,
      moved,
      placed: placed.map((p) => ({ id: p.id, name: p.person.fullName, to: dest(p.personId)! })),
      members: memberRows.map((p) => ({ ...p, to: dest(p.id)!, coordinator: !!p.userId && coordinatorUsers.has(p.userId) })),
      waiting: waiting.map((w) => w.personId),
    }
  })

  // After the move: re-match those waiting for it, text the receiving coordinators about their converts.
  if (out.waiting.length) await rescore(actorId, out.waiting)
  for (const id of out.targets.keys()) {
    const here = out.placed.filter((p) => p.to === id)
    if (here.length) queueNewConvertSms(here.map((p) => ({ ccfId: id, placementId: p.id })), actorId, 'transferred')
  }

  // Its coordinators, if chosen, coordinate the CCF they moved to (alongside anyone already there). As leaders, they are emailed the role.
  const madeCoordinators: Array<{ name: string; ccf: string }> = []
  if (plan.coordinators === 'coordinator') {
    for (const c of out.members.filter((p) => p.coordinator && p.status === 'active')) {
      await assignRoleToMember({ person_id: c.id, role_key: LEADER_ROLE.ccf, ccf_id: c.to }, actorId, origin)
      madeCoordinators.push({ name: c.fullName, ccf: out.targets.get(c.to)!.name })
    }
  }

  return {
    to: [...out.targets.values()].map((t) => ({
      id: t.id,
      name: t.name,
      members: out.members.filter((p) => p.to === t.id).length,
      converts: out.placed.filter((p) => p.to === t.id).length,
    })),
    ...out.moved,
    coordinators: madeCoordinators,
  }
}
