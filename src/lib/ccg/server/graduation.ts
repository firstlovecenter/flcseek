import { prisma } from '@/lib/prisma'
import { ccgTx, logCcg } from './common'
import { lockRow } from './mapping'

/**
 * Graduation: a convert who reaches every active milestone of their assessment
 * becomes a member of their CCF. The placement ends with outcome 'graduated'
 * and the person starts shaping the CCF's profile like any other member.
 *
 * Called after anything that can complete a milestone (a tick, a checklist
 * item, attendance, an approval). Returns the people who graduated.
 */
export async function graduateIfComplete(placementIds: string[], actorId: string | null) {
  const ids = [...new Set(placementIds)]
  if (ids.length === 0) return []
  const [milestones, placements] = await Promise.all([
    prisma.ccgMilestone.findMany({ where: { isActive: true }, select: { stageNumber: true } }),
    prisma.ccgPlacement.findMany({
      where: { id: { in: ids }, status: 'active', person: { deletedAt: null } },
      select: { id: true, personId: true, progressRecords: { where: { isCompleted: true }, select: { stageNumber: true } } },
    }),
  ])
  if (milestones.length === 0) return []
  const required = milestones.map((m) => m.stageNumber)
  const complete = placements.filter((p) => {
    const done = new Set(p.progressRecords.map((r) => r.stageNumber))
    return required.every((s) => done.has(s))
  })

  const graduated: Array<{ person_id: string; placement_id: string; ccf_id: string }> = []
  for (const c of complete) {
    const out = await ccgTx(async (tx) => {
      await lockRow(tx, 'ccg_people', c.personId)
      const p = await tx.ccgPlacement.findUnique({ where: { id: c.id } })
      if (!p || p.status !== 'active' || !p.finalCcfId) return null // someone else got there first
      await tx.ccgPlacement.update({
        where: { id: p.id },
        data: { status: 'ended', outcome: 'graduated', endedAt: new Date(), endReason: 'Completed the assessment', updatedAt: new Date() },
      })
      await tx.ccgPerson.update({
        where: { id: p.personId },
        data: { kind: 'member', status: 'active', ccfId: p.finalCcfId, updatedAt: new Date() },
      })
      await logCcg(
        { userId: actorId, action: 'CONVERT_GRADUATED', entityType: 'ccg_person', entityId: p.personId, newValues: { ccf_id: p.finalCcfId, placement_id: p.id } },
        tx
      )
      return { person_id: p.personId, placement_id: p.id, ccf_id: p.finalCcfId }
    })
    if (out) graduated.push(out)
  }
  return graduated
}
