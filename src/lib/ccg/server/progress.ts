import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { conflict, invalid, notFound } from '../errors'
import {
  assessment,
  attendanceCompletion,
  checklistCompletion,
  daysSince,
  dueDate,
  milestoneState,
  type AttendanceEvent,
  type AutoCompletion,
  type MilestoneState,
} from '../progress'
import { inFilter, type CcgScope, type IdSet } from '../scope'
import { dateOnly, getCcgConfig, iso, logCcg, parseDateOnly, userRefs, type Db } from './common'
import { todayDate } from '../access'
import { graduateIfComplete } from './graduation'

/**
 * Retention milestones for placed converts (CCG Manual). The clock starts when
 * the placement was approved (decided_at); status per milestone is derived.
 *
 * Kinds: manual milestones are ticked by a leader. Attendance and checklist
 * milestones complete themselves: syncAutoMilestones writes their progress
 * record (source 'auto') whenever attendance or a checklist item changes, so
 * every reader (lists, dashboard) sees one stored state, as in Seek.
 */

const placementInclude = {
  person: { select: { id: true, fullName: true, refCode: true, phone: true, status: true } },
  finalCcf: { include: { ccg: true } },
  progressRecords: true,
  progressItems: true,
  checkIns: { orderBy: { recordedAt: 'desc' as const }, take: 1 },
} satisfies Prisma.CcgPlacementInclude

const milestoneInclude = {
  items: { orderBy: [{ sortOrder: 'asc' as const }, { label: 'asc' as const }] },
} satisfies Prisma.CcgMilestoneInclude

type PlacementRow = Prisma.CcgPlacementGetPayload<{ include: typeof placementInclude }>
type MilestoneRow = Prisma.CcgMilestoneGetPayload<{ include: typeof milestoneInclude }>
/** personId → event type → attendance dates (yyyy-mm-dd). */
type AttendanceIndex = Map<string, Map<string, string[]>>

export function serializeMilestone(m: MilestoneRow) {
  return {
    id: m.id,
    stage_number: m.stageNumber,
    name: m.name,
    short_name: m.shortName,
    kind: m.kind,
    attendance_event: m.attendanceEvent,
    attendance_target: m.attendanceTarget,
    description: m.description,
    guidance: m.guidance,
    target_days: m.targetDays,
    is_active: m.isActive,
    items:
      m.kind === 'checklist'
        ? m.items.map((i) => ({ id: i.id, key: i.key, label: i.label, help: i.help, sort_order: i.sortOrder, is_active: i.isActive }))
        : [],
  }
}

export async function loadMilestones(db: Db = prisma, includeInactive = false) {
  return db.ccgMilestone.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: milestoneInclude,
    orderBy: { stageNumber: 'asc' },
  })
}

async function loadAttendance(personIds: string[], db: Db = prisma): Promise<AttendanceIndex> {
  const out: AttendanceIndex = new Map()
  if (personIds.length === 0) return out
  const rows = await db.ccgAttendance.findMany({
    where: { personId: { in: [...new Set(personIds)] } },
    select: { personId: true, eventType: true, eventDate: true },
  })
  for (const r of rows) {
    const byEvent = out.get(r.personId) ?? new Map<string, string[]>()
    byEvent.set(r.eventType, [...(byEvent.get(r.eventType) ?? []), dateOnly(r.eventDate)!])
    out.set(r.personId, byEvent)
  }
  return out
}

/** Auto-completion for one attendance / checklist milestone (null for manual). */
function autoCompletion(
  m: MilestoneRow,
  personId: string,
  itemsDone: Map<string, string>,
  attendance: AttendanceIndex
): AutoCompletion | null {
  if (m.kind === 'attendance' && m.attendanceEvent && m.attendanceTarget) {
    return attendanceCompletion(attendance.get(personId)?.get(m.attendanceEvent) ?? [], m.attendanceTarget)
  }
  if (m.kind === 'checklist') {
    return checklistCompletion(
      m.items.filter((i) => i.isActive).map((i) => i.id),
      itemsDone
    )
  }
  return null
}

function itemsDoneOf(p: { progressItems: Array<{ itemId: string; doneOn: Date }> }) {
  return new Map(p.progressItems.map((i) => [i.itemId, dateOnly(i.doneOn)!]))
}

function progressRow(
  p: PlacementRow,
  milestones: MilestoneRow[],
  names: Map<string, { id: string; name: string }>,
  attendance: AttendanceIndex,
  today: Date,
  withItems: boolean,
  assessmentDays: number
) {
  const start = p.decidedAt ?? p.createdAt ?? today
  const records = new Map(p.progressRecords.map((r) => [r.stageNumber, r]))
  const itemsDone = itemsDoneOf(p)
  const c = p.checkIns[0]
  const stages = milestones.map((m) => {
    const r = records.get(m.stageNumber)
    const state: MilestoneState = milestoneState(start, m.targetDays, r?.isCompleted ?? false, today)
    const auto = autoCompletion(m, p.person.id, itemsDone, attendance)
    return {
      stage_number: m.stageNumber,
      kind: m.kind,
      state,
      due_date: dateOnly(dueDate(start, m.targetDays)),
      is_completed: r?.isCompleted ?? false,
      date_completed: dateOnly(r?.dateCompleted),
      notes: r?.notes ?? null,
      /** Attendance: count so far / target. Checklist: items done / active items. */
      progress: auto ? { done: auto.done, total: auto.total } : null,
      ...(withItems && m.kind === 'checklist'
        ? {
            items: m.items
              .filter((i) => i.isActive)
              .map((i) => ({ id: i.id, key: i.key, label: i.label, help: i.help, done_on: itemsDone.get(i.id) ?? null })),
          }
        : {}),
    }
  })
  return {
    placement_id: p.id,
    person: { id: p.person.id, full_name: p.person.fullName, ref_code: p.person.refCode, phone: p.person.phone, status: p.person.status },
    ccf: p.finalCcf ? { id: p.finalCcf.id, code: p.finalCcf.code, name: p.finalCcf.name, ccg: { id: p.finalCcf.ccg.id, name: p.finalCcf.ccg.name } } : null,
    placed_at: iso(start),
    days_since_placement: daysSince(start, today),
    was_remapped: p.decision === 'remapped',
    stages,
    completed: stages.filter((s) => s.state === 'done').length,
    overdue: stages.filter((s) => s.state === 'overdue').length,
    /** The assessment year from approval: ends_on, days_left, state. */
    assessment: assessment(start, assessmentDays, stages.filter((s) => s.state === 'done').length, stages.length, today),
    latest_check_in: c
      ? {
          id: c.id,
          convert_rating: c.convertRating,
          group_rating: c.groupRating,
          follow_up_required: c.followUpRequired,
          notes: c.notes,
          recorded_by: c.recordedBy ? names.get(c.recordedBy) ?? null : null,
          recorded_at: iso(c.recordedAt),
        }
      : null,
  }
}

export async function listProgress(
  scope: CcgScope,
  filter: {
    ccfId?: string | null
    ccgId?: string | null
    councilId?: string | null
    streamId?: string | null
    overdueOnly?: boolean
    /** Only the converts assigned to this Sheep Seeker (their own member id). */
    seekerPersonId?: string | null
  }
) {
  const within = inFilter(scope.ccfIds('placements.view'))
  // In scope: CCFs the viewer covers, plus a Sheep Seeker's assigned converts wherever they are placed.
  const mine = scope.seekerPersonId && scope.canOnAssigned('placements.view', scope.seekerPersonId) ? scope.seekerPersonId : null
  const [milestones, rows, config] = await Promise.all([
    loadMilestones(),
    prisma.ccgPlacement.findMany({
      where: {
        status: 'active',
        person: { deletedAt: null },
        AND: [
          within ? { OR: [{ finalCcfId: within }, ...(mine ? [{ person: { seekerPersonId: mine } }] : [])] } : {},
          filter.seekerPersonId ? { person: { seekerPersonId: filter.seekerPersonId } } : {},
          filter.ccfId ? { finalCcfId: filter.ccfId } : {},
          filter.ccgId ? { finalCcf: { ccgId: filter.ccgId } } : {},
          filter.councilId ? { finalCcf: { ccg: { councilId: filter.councilId } } } : {},
          filter.streamId ? { finalCcf: { ccg: { council: { streamId: filter.streamId } } } } : {},
        ],
      },
      include: placementInclude,
      orderBy: [{ decidedAt: 'asc' }],
    }),
    getCcgConfig(),
  ])
  const [names, attendance] = await Promise.all([
    userRefs(rows.flatMap((r) => r.checkIns.map((c) => c.recordedBy))),
    loadAttendance(rows.map((r) => r.personId)),
  ])
  const today = new Date()
  let out = rows.map((r) => progressRow(r, milestones, names, attendance, today, false, config.assessmentDays))
  if (filter.overdueOnly) out = out.filter((r) => r.overdue > 0)
  return { milestones: milestones.map(serializeMilestone), rows: out }
}

export async function getActivePlacement(placementId: string) {
  const p = await prisma.ccgPlacement.findUnique({ where: { id: placementId }, include: placementInclude })
  if (!p) throw notFound('Placement')
  return p
}

/** One placement's milestones, with checklist items and guidance. */
export async function placementProgress(placementId: string) {
  const p = await getActivePlacement(placementId)
  const [milestones, config] = await Promise.all([loadMilestones(), getCcgConfig()])
  const [names, attendance] = await Promise.all([userRefs(p.checkIns.map((c) => c.recordedBy)), loadAttendance([p.personId])])
  return {
    ...progressRow(p, milestones, names, attendance, new Date(), true, config.assessmentDays),
    milestones: milestones.map(serializeMilestone),
  }
}

/**
 * Recompute attendance and checklist milestones for these placements and store
 * the result (source 'auto'). Completes or un-completes; never touches manual
 * milestones. Only active placements are synced.
 */
export async function syncAutoMilestones(placementIds: string[] | 'all_active', db: Db = prisma) {
  const placements = await db.ccgPlacement.findMany({
    where: { status: 'active', ...(placementIds === 'all_active' ? {} : { id: { in: placementIds } }) },
    select: { id: true, personId: true, progressRecords: true, progressItems: { select: { itemId: true, doneOn: true } } },
  })
  if (placements.length === 0) return { changed: 0 }
  const milestones = (await loadMilestones(db)).filter((m) => m.kind !== 'manual')
  if (milestones.length === 0) return { changed: 0 }
  const attendance = await loadAttendance(placements.map((p) => p.personId), db)

  let changed = 0
  for (const p of placements) {
    const records = new Map(p.progressRecords.map((r) => [r.stageNumber, r]))
    const itemsDone = itemsDoneOf(p)
    for (const m of milestones) {
      const auto = autoCompletion(m, p.personId, itemsDone, attendance)
      if (!auto) continue
      const r = records.get(m.stageNumber)
      const key = { placementId_stageNumber: { placementId: p.id, stageNumber: m.stageNumber } }
      if (auto.complete) {
        const date = parseDateOnly(auto.completedOn)
        if (r?.isCompleted && r.source === 'auto' && dateOnly(r.dateCompleted) === auto.completedOn) continue
        await db.ccgProgressRecord.upsert({
          where: key,
          create: { placementId: p.id, stageNumber: m.stageNumber, isCompleted: true, dateCompleted: date, source: 'auto' },
          update: { isCompleted: true, dateCompleted: date, source: 'auto', updatedAt: new Date() },
        })
        changed++
      } else if (r?.isCompleted) {
        await db.ccgProgressRecord.update({
          where: key,
          data: { isCompleted: false, dateCompleted: null, source: 'auto', updatedAt: new Date() },
        })
        changed++
      }
    }
  }
  return { changed }
}

async function activePlacementOrThrow(placementId: string, what: string) {
  const p = await prisma.ccgPlacement.findUnique({ where: { id: placementId } })
  if (!p) throw notFound('Placement')
  if (p.status !== 'active') throw conflict(`${what} can only be recorded for an active placement`)
  return p
}

function checkCompletionDate(date: Date, placedAt: Date | null) {
  const today = todayDate()
  if (placedAt && date < todayDate(placedAt)) throw invalid('The completion date cannot be before the placement was approved')
  if (date > today) throw invalid('The completion date cannot be in the future')
}

/** Tick or untick a manual milestone. */
export async function setProgress(
  placementId: string,
  body: { stage_number: number; is_completed: boolean; date_completed?: string | null; notes?: string | null },
  actorId: string
) {
  const p = await activePlacementOrThrow(placementId, 'Milestones')
  const milestone = await prisma.ccgMilestone.findUnique({ where: { stageNumber: body.stage_number } })
  if (!milestone || !milestone.isActive) throw notFound('Milestone')
  if (milestone.kind === 'attendance') throw conflict('This milestone completes itself from marked attendance')
  if (milestone.kind === 'checklist') throw conflict('This milestone completes itself when every checklist item is ticked')

  const date = body.is_completed ? parseDateOnly(body.date_completed) ?? todayDate() : null
  if (date) checkCompletionDate(date, p.decidedAt ?? p.createdAt)

  const record = await prisma.ccgProgressRecord.upsert({
    where: { placementId_stageNumber: { placementId, stageNumber: body.stage_number } },
    create: { placementId, stageNumber: body.stage_number, isCompleted: body.is_completed, dateCompleted: date, notes: body.notes ?? null, updatedBy: actorId },
    update: {
      isCompleted: body.is_completed,
      dateCompleted: date,
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      source: 'manual',
      updatedBy: actorId,
      updatedAt: new Date(),
    },
  })
  await logCcg({
    userId: actorId,
    action: body.is_completed ? 'MILESTONE_COMPLETED' : 'MILESTONE_UNCHECKED',
    entityType: 'ccg_placement',
    entityId: placementId,
    newValues: { stage_number: body.stage_number },
  })
  const graduated = body.is_completed ? await graduateIfComplete([placementId], actorId) : []
  return { record, graduated: graduated.length > 0 }
}

/** Tick or untick one checklist item; the milestone completes itself when all are ticked. */
export async function setChecklistItem(
  placementId: string,
  body: { item_id: string; done: boolean; date_completed?: string | null },
  actorId: string
) {
  const p = await activePlacementOrThrow(placementId, 'Checklist items')
  const item = await prisma.ccgMilestoneItem.findUnique({ where: { id: body.item_id }, include: { milestone: true } })
  if (!item || !item.isActive || !item.milestone.isActive || item.milestone.kind !== 'checklist') throw notFound('Checklist item')

  if (body.done) {
    const date = parseDateOnly(body.date_completed) ?? todayDate()
    checkCompletionDate(date, null)
    await prisma.ccgProgressItem.upsert({
      where: { placementId_itemId: { placementId, itemId: item.id } },
      create: { placementId, itemId: item.id, doneOn: date, updatedBy: actorId },
      update: { doneOn: date, updatedBy: actorId, updatedAt: new Date() },
    })
  } else {
    await prisma.ccgProgressItem.deleteMany({ where: { placementId, itemId: item.id } })
  }
  await syncAutoMilestones([p.id])
  await logCcg({
    userId: actorId,
    action: body.done ? 'CHECKLIST_ITEM_DONE' : 'CHECKLIST_ITEM_UNDONE',
    entityType: 'ccg_placement',
    entityId: placementId,
    newValues: { stage_number: item.milestone.stageNumber, item: item.key },
  })
  const graduated = body.done ? await graduateIfComplete([p.id], actorId) : []
  return { graduated: graduated.length > 0 }
}

// ---------------------------------------------------------------------------
// Attendance registers (per CCF, per event, per day)
// ---------------------------------------------------------------------------

async function registerPlacements(ccfId: string) {
  return prisma.ccgPlacement.findMany({
    where: { status: 'active', finalCcfId: ccfId, person: { deletedAt: null } },
    select: { id: true, personId: true, person: { select: { id: true, fullName: true, refCode: true, phone: true } } },
    orderBy: { person: { fullName: 'asc' } },
  })
}

export async function attendanceRegister(ccfId: string, eventType: AttendanceEvent, eventDate: string) {
  const ccf = await prisma.ccgFamily.findFirst({ where: { id: ccfId, deletedAt: null }, include: { ccg: true } })
  if (!ccf) throw notFound('CCF')
  const placements = await registerPlacements(ccfId)
  const personIds = placements.map((p) => p.personId)
  const [present, totals] = await Promise.all([
    prisma.ccgAttendance.findMany({
      where: { personId: { in: personIds }, eventType, eventDate: parseDateOnly(eventDate)! },
      select: { personId: true },
    }),
    prisma.ccgAttendance.groupBy({
      by: ['personId'],
      where: { personId: { in: personIds }, eventType },
      _count: { _all: true },
    }),
  ])
  const here = new Set(present.map((a) => a.personId))
  const total = new Map(totals.map((t) => [t.personId, t._count._all]))
  return {
    ccf: { id: ccf.id, code: ccf.code, name: ccf.name, ccg: { id: ccf.ccg.id, name: ccf.ccg.name } },
    event_type: eventType,
    event_date: eventDate,
    rows: placements.map((p) => ({
      placement_id: p.id,
      person: { id: p.person.id, full_name: p.person.fullName, ref_code: p.person.refCode, phone: p.person.phone },
      present: here.has(p.personId),
      total: total.get(p.personId) ?? 0,
    })),
  }
}

/** Save a register: present → recorded, absent → removed for that day. Then re-sync milestones. */
export async function saveAttendance(
  body: { ccf_id: string; event_type: AttendanceEvent; event_date: string; entries: Array<{ person_id: string; present: boolean }> },
  actorId: string
) {
  const date = parseDateOnly(body.event_date)!
  if (date > todayDate()) throw invalid('Attendance cannot be marked for a future date')

  const placements = await registerPlacements(body.ccf_id)
  const placementOf = new Map(placements.map((p) => [p.personId, p.id]))
  const strangers = body.entries.filter((e) => !placementOf.has(e.person_id))
  if (strangers.length) throw invalid('Some people are not converts placed in this CCF', { person_ids: strangers.map((e) => e.person_id) })

  const present = [...new Set(body.entries.filter((e) => e.present).map((e) => e.person_id))]
  const absent = [...new Set(body.entries.filter((e) => !e.present).map((e) => e.person_id))].filter((id) => !present.includes(id))

  await prisma.$transaction([
    prisma.ccgAttendance.createMany({
      data: present.map((personId) => ({ personId, eventType: body.event_type, eventDate: date, ccfId: body.ccf_id, markedBy: actorId })),
      skipDuplicates: true,
    }),
    prisma.ccgAttendance.deleteMany({ where: { personId: { in: absent }, eventType: body.event_type, eventDate: date } }),
  ])
  const touched = [...present, ...absent].map((id) => placementOf.get(id)!)
  const { changed } = await syncAutoMilestones(touched)
  await logCcg({
    userId: actorId,
    action: 'ATTENDANCE_MARKED',
    entityType: 'ccg_family',
    entityId: body.ccf_id,
    newValues: { event_type: body.event_type, event_date: body.event_date, present: present.length, absent: absent.length },
  })
  const graduated = present.length ? await graduateIfComplete(present.map((id) => placementOf.get(id)!), actorId) : []
  return { present: present.length, absent: absent.length, milestones_changed: changed, graduated: graduated.map((g) => g.person_id) }
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

export async function listCheckIns(placementId: string) {
  const rows = await prisma.ccgCheckIn.findMany({ where: { placementId }, orderBy: { recordedAt: 'desc' } })
  const names = await userRefs(rows.map((r) => r.recordedBy))
  return rows.map((c) => ({
    id: c.id,
    convert_rating: c.convertRating,
    group_rating: c.groupRating,
    follow_up_required: c.followUpRequired,
    notes: c.notes,
    recorded_by: c.recordedBy ? names.get(c.recordedBy) ?? null : null,
    recorded_at: iso(c.recordedAt),
  }))
}

export async function recordCheckIn(
  placementId: string,
  body: { convert_rating?: number | null; group_rating?: number | null; follow_up_required: boolean; notes?: string | null },
  actorId: string
) {
  await activePlacementOrThrow(placementId, 'Check-ins')
  if (!body.convert_rating && !body.group_rating && !body.notes && !body.follow_up_required) {
    throw invalid('Add a rating, a note, or flag a follow-up')
  }
  const c = await prisma.ccgCheckIn.create({
    data: {
      placementId,
      convertRating: body.convert_rating ?? null,
      groupRating: body.group_rating ?? null,
      followUpRequired: body.follow_up_required,
      notes: body.notes ?? null,
      recordedBy: actorId,
    },
  })
  await logCcg({ userId: actorId, action: 'CHECK_IN_RECORDED', entityType: 'ccg_placement', entityId: placementId, newValues: { follow_up_required: body.follow_up_required } })
  return c
}
