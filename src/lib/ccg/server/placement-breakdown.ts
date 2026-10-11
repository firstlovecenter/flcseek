import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { forbidden, invalid } from '../errors'
import type { CcgScope } from '../scope'
import { iso } from './common'

/**
 * Where a stream's converts have gone, for its Sheep Seeking Admin: per CCF
 * (with its CCG and council, so the page can roll up to every level), how many
 * are in the CCF now, placed there in the period, awaiting approval or on hold
 * for it, became members and dropped; plus the converts not placed yet.
 *
 * "Now" counts (in CCF, awaiting, on hold, not placed yet) are today's. The
 * period (from/to) narrows those that happened: placed, became members, dropped.
 */

const SUCCESS_OUTCOMES = ['graduated', 'made_member']

export interface BreakdownFilters {
  streamId: string | null
  councilId: string | null
  ccgId: string | null
  /** A Sheep Seeker's member id: only the converts they registered. */
  seekerId: string | null
  from: Date | null
  /** Exclusive. */
  to: Date | null
}

export const COUNTS = ['in_ccf', 'placed', 'awaiting', 'on_hold', 'became_members', 'dropped'] as const
type Counts = Record<(typeof COUNTS)[number], number>
const empty = (): Counts => ({ in_ccf: 0, placed: 0, awaiting: 0, on_hold: 0, became_members: 0, dropped: 0 })

export async function placementBreakdown(full: CcgScope, f: BreakdownFilters) {
  const scope = full.sheepSeeking()
  const inScope = scope.streamIds('reports.view')
  if (f.streamId && !scope.canOnStream('reports.view', f.streamId)) throw forbidden('You can only see your streams')
  const streams: string[] | 'all' = f.streamId ? [f.streamId] : inScope
  if (streams !== 'all' && streams.length === 0) throw forbidden('This is for the streams you run sheep seeking in')
  if (f.from && f.to && f.from >= f.to) throw invalid('The period must end after it starts')

  // The CCFs counted: those of these streams, narrowed to a council or CCG.
  const ccgWhere: Prisma.CcgGroupWhereInput = {
    deletedAt: null,
    ...(streams === 'all' ? {} : { streamId: { in: streams } }),
    ...(f.councilId ? { councilId: f.councilId } : {}),
    ...(f.ccgId ? { id: f.ccgId } : {}),
  }
  const ccfs = await prisma.ccgFamily.findMany({
    where: { deletedAt: null, ccg: ccgWhere },
    select: {
      id: true,
      name: true,
      status: true,
      ccg: {
        select: {
          id: true,
          name: true,
          stream: { select: { id: true, name: true } },
          council: { select: { id: true, name: true, deletedAt: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })
  const ccfIds = ccfs.map((c) => c.id)

  const person: Prisma.CcgPersonWhereInput = { deletedAt: null, ...(f.seekerId ? { seekerPersonId: f.seekerId } : {}) }
  const period = f.from || f.to ? { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } : undefined
  const count = async (by: 'finalCcfId' | 'proposedCcfId', where: Prisma.CcgPlacementWhereInput) => {
    const rows = await prisma.ccgPlacement.groupBy({ by: [by], where: { ...where, [by]: { in: ccfIds }, person }, _count: { _all: true } })
    return new Map(rows.map((r) => [r[by] as string, r._count._all]))
  }
  const [inCcf, placed, awaiting, onHold, became, dropped, unplaced] = await Promise.all([
    count('finalCcfId', { status: 'active' }),
    count('finalCcfId', { decision: { in: ['approved', 'remapped'] }, ...(period ? { decidedAt: period } : {}) }),
    count('proposedCcfId', { status: 'proposed' }),
    count('proposedCcfId', { status: 'held' }),
    count('finalCcfId', { status: 'ended', outcome: { in: SUCCESS_OUTCOMES }, ...(period ? { endedAt: period } : {}) }),
    count('finalCcfId', { status: 'ended', outcome: { notIn: SUCCESS_OUTCOMES }, NOT: { outcome: null }, ...(period ? { endedAt: period } : {}) }),
    // Not placed yet: new, needing more information, or proposed somewhere (CCF filters don't narrow these).
    f.councilId || f.ccgId
      ? Promise.resolve(null)
      : prisma.ccgPerson.groupBy({
          by: ['status'],
          where: { ...person, kind: 'convert', status: { in: ['new', 'needs_info', 'proposed'] }, ...(streams === 'all' ? {} : { streamId: { in: streams } }) },
          _count: { _all: true },
        }),
  ])

  const rows = ccfs.map((c) => {
    const n: Counts = {
      in_ccf: inCcf.get(c.id) ?? 0,
      placed: placed.get(c.id) ?? 0,
      awaiting: awaiting.get(c.id) ?? 0,
      on_hold: onHold.get(c.id) ?? 0,
      became_members: became.get(c.id) ?? 0,
      dropped: dropped.get(c.id) ?? 0,
    }
    const council = c.ccg.council && !c.ccg.council.deletedAt ? { id: c.ccg.council.id, name: c.ccg.council.name } : null
    return { ccf: { id: c.id, name: c.name, status: c.status }, ccg: { id: c.ccg.id, name: c.ccg.name }, council, stream: c.ccg.stream, ...n }
  })
  const total = rows.reduce<Counts>((t, r) => {
    for (const k of COUNTS) t[k] += r[k]
    return t
  }, empty())
  const notPlaced = unplaced ? Object.fromEntries(unplaced.map((u) => [u.status, u._count._all])) : null

  return {
    filters: { stream_id: f.streamId, council_id: f.councilId, ccg_id: f.ccgId, seeker_id: f.seekerId, from: iso(f.from), to: iso(f.to) },
    rows,
    total,
    /** Converts of these streams not in a CCF yet, by status (null when narrowed to a council or CCG). */
    not_placed: notPlaced
      ? { new: notPlaced.new ?? 0, needs_info: notPlaced.needs_info ?? 0, proposed: notPlaced.proposed ?? 0 }
      : null,
  }
}
