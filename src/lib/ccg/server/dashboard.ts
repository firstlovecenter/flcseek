import { prisma } from '@/lib/prisma'
import type { CapacityStatus, RelationshipHealth } from '../engine'
import { assessment, milestoneState, type AssessmentState } from '../progress'
import { inFilter, type CcgScope } from '../scope'
import { getCcgConfig } from './common'
import { placementScopeWhere } from './placement-dto'
import { loadProfiles } from './profiles'
import { loadQuestionBank } from './questions'
import { ccfIdsIn, type UnitType } from './unit-overview'
import { weeklyTasks } from './weekly'

const DAY = 86_400_000

/**
 * Dashboard numbers for the units the viewer can report on, narrowed to the
 * unit in focus when one is given ("church in focus"; the caller checks the
 * viewer may see it).
 */
export async function dashboard(scope: CcgScope, focus: { type: UnitType; id: string } | null = null) {
  const inScope = scope.ccfIds('reports.view')
  const unitIds = focus ? await ccfIdsIn(focus.type, focus.id) : null
  const ccfIds = unitIds ? (inScope === 'all' ? unitIds : unitIds.filter((id) => inScope.includes(id))) : inScope
  const within = inFilter(ccfIds)
  // The central team sees the whole queue; a stream's Sheep Seekers see their stream's.
  const seesQueue = scope.can('placements.view') || (scope.streamIds('placements.view') as string[]).length > 0
  const scopeStreams = scope.streamIds('people.view')
  // Converts waiting are counted church-wide or per stream, not per CCF.
  const waitingStreams =
    focus?.type === 'stream'
      ? scopeStreams === 'all' || scopeStreams.includes(focus.id)
        ? [focus.id]
        : []
      : focus
        ? []
        : scopeStreams
  const now = new Date()

  const [bank, config] = await Promise.all([loadQuestionBank(), getCcgConfig()])
  const [{ profiles }, milestones, active, decided, pendingMembers, queue, waiting, week] = await Promise.all([
    loadProfiles({ bank, config, ccfIds: ccfIds === 'all' ? undefined : ccfIds }),
    prisma.ccgMilestone.findMany({ where: { isActive: true } }),
    prisma.ccgPlacement.findMany({
      where: { status: 'active', person: { deletedAt: null }, ...(within ? { finalCcfId: within } : {}) },
      select: {
        decidedAt: true,
        createdAt: true,
        progressRecords: { select: { stageNumber: true, isCompleted: true } },
        checkIns: { orderBy: { recordedAt: 'desc' }, take: 1, select: { followUpRequired: true } },
      },
    }),
    prisma.ccgPlacement.groupBy({
      by: ['decision'],
      where: { decision: { not: null }, ...(within ? { finalCcfId: within } : {}) },
      _count: { _all: true },
    }),
    prisma.ccgPerson.count({ where: { kind: 'member', status: 'pending', deletedAt: null, ...(within ? { ccfId: within } : {}) } }),
    seesQueue
      ? prisma.ccgPlacement.findMany({
          where: {
            status: { in: ['proposed', 'held'] },
            person: { deletedAt: null },
            AND: [
              placementScopeWhere(scope),
              focus
                ? {
                    OR: [
                      { proposedCcfId: { in: unitIds ?? [] } },
                      ...(focus.type === 'stream' ? [{ person: { streamId: focus.id } }] : []),
                    ],
                  }
                : {},
            ],
          },
          select: { status: true, createdAt: true },
        })
      : Promise.resolve([] as Array<{ status: string; createdAt: Date | null }>),
    waitingStreams === 'all' || waitingStreams.length
      ? prisma.ccgPerson.count({
          where: {
            kind: 'convert',
            deletedAt: null,
            status: { in: ['new', 'needs_info'] },
            ...(waitingStreams === 'all' ? {} : { streamId: { in: waitingStreams } }),
          },
        })
      : Promise.resolve(null),
    weeklyTasks(focus, now),
  ])

  const capacity: Record<CapacityStatus, number> = { below_minimum: 0, healthy: 0, near_capacity: 0, full: 0 }
  const health: Record<RelationshipHealth, number> = { critical: 0, needs_attention: 0, healthy: 0 }
  let spaces = 0
  let activeUnits = 0
  // (members counts every CCF in focus, active or not)
  for (const p of profiles) {
    if (p.unit.status !== 'active' || p.unit.ccgStatus !== 'active') continue
    activeUnits++
    capacity[p.capacityStatus]++
    health[p.health]++
    spaces += p.availableSpaces
  }

  const byStage = [...milestones]
    .sort((a, b) => a.stageNumber - b.stageNumber)
    .map((m) => ({ stage_number: m.stageNumber, short_name: m.shortName, done: 0, overdue: 0, due_soon: 0, upcoming: 0, no_deadline: 0 }))
  let overdue = 0
  let followUps = 0
  const assessments: Record<AssessmentState, number> = { in_progress: 0, complete: 0, ended_incomplete: 0 }
  for (const a of active) {
    const start = a.decidedAt ?? a.createdAt ?? now
    const done = new Map(a.progressRecords.map((r) => [r.stageNumber, r.isCompleted]))
    let reached = 0
    byStage.forEach((s) => {
      const m = milestones.find((x) => x.stageNumber === s.stage_number)!
      const state = milestoneState(start, m.targetDays, done.get(m.stageNumber) ?? false, now)
      s[state]++
      if (state === 'overdue') overdue++
      if (state === 'done') reached++
    })
    assessments[assessment(start, config.assessmentDays, reached, milestones.length, now).state]++
    if (a.checkIns[0]?.followUpRequired) followUps++
  }

  const approved = decided.find((d) => d.decision === 'approved')?._count._all ?? 0
  const remapped = decided.find((d) => d.decision === 'remapped')?._count._all ?? 0
  const proposed = queue.filter((q) => q.status === 'proposed')
  const oldest = proposed.reduce<Date | null>((o, q) => (q.createdAt && (!o || q.createdAt < o) ? q.createdAt : o), null)

  return {
    units: {
      active_ccfs: activeUnits,
      open_spaces: spaces,
      members: profiles.reduce((n, p) => n + p.own.memberCount, 0),
      capacity,
      health,
    },
    /** This week's duties for the unit in focus. */
    week,
    queue: seesQueue
      ? {
          proposed: proposed.length,
          held: queue.length - proposed.length,
          oldest_proposal_days: oldest ? Math.floor((now.getTime() - oldest.getTime()) / DAY) : null,
        }
      : null,
    converts_waiting: waiting,
    members_pending_confirmation: pendingMembers,
    placements: {
      active: active.length,
      milestones_overdue: overdue,
      follow_ups: followUps,
      approved,
      remapped,
      remap_rate: approved + remapped ? Math.round((remapped / (approved + remapped)) * 1000) / 10 : null,
      /** Active placements by where they stand in their assessment year. */
      assessments,
    },
    milestones: byStage,
  }
}
