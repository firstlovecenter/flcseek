import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { todayDate } from '../access'
import { invalid, notFound } from '../errors'
import { heldThisPeriod, periodStart, type Cadence } from '../progress'
import { inFilter, type IdSet } from '../scope'
import { ccgTx, dateOnly, iso, logCcg, parseDateOnly, userRefs } from './common'

/**
 * CCG activities from the CCG Manual: the weekly half hour of intercession
 * (converts prayed for by name) and the quarterly informal fellowship over
 * food. Logged per CCG; types are DB-backed and editable.
 */

type TypeRow = Prisma.CcgActivityTypeGetPayload<object>

export function serializeActivityType(t: TypeRow) {
  return {
    key: t.key,
    name: t.name,
    cadence: t.cadence as Cadence,
    schedule: t.schedule,
    lists_people: t.listsPeople,
    guidance: t.guidance,
    is_active: t.isActive,
    sort_order: t.sortOrder,
  }
}

export async function listActivityTypes(includeInactive = false) {
  const rows = await prisma.ccgActivityType.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return rows.map(serializeActivityType)
}

const activityInclude = {
  ccg: { select: { id: true, code: true, name: true } },
  type: true,
  people: { include: { person: { select: { id: true, fullName: true, refCode: true } } } },
} satisfies Prisma.CcgGroupActivityInclude

type ActivityRow = Prisma.CcgGroupActivityGetPayload<{ include: typeof activityInclude }>

function serializeActivity(a: ActivityRow, names: Map<string, { id: string; name: string }>) {
  return {
    id: a.id,
    ccg: a.ccg,
    type: { key: a.type.key, name: a.type.name },
    held_on: dateOnly(a.heldOn),
    attendee_count: a.attendeeCount,
    notes: a.notes,
    prayed_for: a.people.map((p) => ({ id: p.person.id, full_name: p.person.fullName, ref_code: p.person.refCode })),
    recorded_by: a.recordedBy ? names.get(a.recordedBy) ?? null : null,
    created_at: iso(a.createdAt),
  }
}

/** Activities in scope, newest first, plus per CCG and type whether it has been held this period. */
export async function listGroupActivities(ccgIds: IdSet, filter: { ccgId?: string | null; typeKey?: string | null; limit?: number }) {
  const within = inFilter(ccgIds)
  const ccgWhere: Prisma.CcgGroupWhereInput = { deletedAt: null, ...(within ? { id: within } : {}), ...(filter.ccgId ? { id: filter.ccgId } : {}) }
  if (within && filter.ccgId && !within.in.includes(filter.ccgId)) return { activities: [], summary: [] }

  const [rows, types, ccgs, latest] = await Promise.all([
    prisma.ccgGroupActivity.findMany({
      where: { ccg: ccgWhere, ...(filter.typeKey ? { typeKey: filter.typeKey } : {}) },
      include: activityInclude,
      orderBy: [{ heldOn: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(filter.limit ?? 100, 500),
    }),
    prisma.ccgActivityType.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.ccgGroup.findMany({ where: { ...ccgWhere, status: 'active' }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
    prisma.ccgGroupActivity.groupBy({ by: ['ccgId', 'typeKey'], where: { ccg: ccgWhere }, _max: { heldOn: true } }),
  ])
  const names = await userRefs(rows.map((r) => r.recordedBy))
  const last = new Map(latest.map((l) => [`${l.ccgId}:${l.typeKey}`, dateOnly(l._max.heldOn)]))
  const today = new Date()

  return {
    activities: rows.map((r) => serializeActivity(r, names)),
    summary: ccgs.map((g) => ({
      ccg: g,
      types: types.map((t) => {
        const lastHeld = last.get(`${g.id}:${t.key}`) ?? null
        const cadence = t.cadence as Cadence
        return {
          key: t.key,
          name: t.name,
          cadence,
          period_start: periodStart(cadence, today),
          last_held_on: lastHeld,
          held_this_period: heldThisPeriod(cadence, lastHeld, today),
        }
      }),
    })),
  }
}

export async function recordGroupActivity(
  body: { ccg_id: string; type_key: string; held_on: string; attendee_count?: number | null; notes?: string | null; person_ids: string[] },
  actorId: string
) {
  const [ccg, type] = await Promise.all([
    prisma.ccgGroup.findFirst({ where: { id: body.ccg_id, deletedAt: null } }),
    prisma.ccgActivityType.findUnique({ where: { key: body.type_key } }),
  ])
  if (!ccg) throw notFound('CCG')
  if (!type || !type.isActive) throw notFound('Activity type')
  const heldOn = parseDateOnly(body.held_on)!
  if (heldOn > todayDate()) throw invalid('An activity cannot be logged for a future date')

  const personIds = type.listsPeople ? [...new Set(body.person_ids)] : []
  if (personIds.length) {
    const placed = await prisma.ccgPlacement.findMany({
      where: { status: 'active', personId: { in: personIds }, finalCcf: { ccgId: ccg.id }, person: { deletedAt: null } },
      select: { personId: true },
    })
    const ok = new Set(placed.map((p) => p.personId))
    const strangers = personIds.filter((id) => !ok.has(id))
    if (strangers.length) throw invalid('Some people are not converts placed in this CCG', { person_ids: strangers })
  }

  const key = { ccgId_typeKey_heldOn: { ccgId: ccg.id, typeKey: type.key, heldOn } }
  const data = { attendeeCount: body.attendee_count ?? null, notes: body.notes ?? null, recordedBy: actorId }
  const activity = await ccgTx(async (tx) => {
    const a = await tx.ccgGroupActivity.upsert({
      where: key,
      create: { ccgId: ccg.id, typeKey: type.key, heldOn, ...data },
      update: { ...data, updatedAt: new Date() },
    })
    await tx.ccgGroupActivityPerson.deleteMany({ where: { activityId: a.id } })
    if (personIds.length) {
      await tx.ccgGroupActivityPerson.createMany({ data: personIds.map((personId) => ({ activityId: a.id, personId })) })
    }
    return a
  })
  await logCcg({
    userId: actorId,
    action: 'GROUP_ACTIVITY_RECORDED',
    entityType: 'ccg_group',
    entityId: ccg.id,
    newValues: { type: type.key, held_on: body.held_on, prayed_for: personIds.length },
  })
  return { id: activity.id }
}

export async function getGroupActivity(id: string) {
  const a = await prisma.ccgGroupActivity.findUnique({ where: { id }, select: { id: true, ccgId: true, typeKey: true, heldOn: true } })
  if (!a) throw notFound('Activity')
  return a
}

export async function deleteGroupActivity(id: string, actorId: string) {
  const a = await getGroupActivity(id)
  await prisma.ccgGroupActivity.delete({ where: { id } })
  await logCcg({
    userId: actorId,
    action: 'GROUP_ACTIVITY_DELETED',
    entityType: 'ccg_group',
    entityId: a.ccgId,
    oldValues: { type: a.typeKey, held_on: dateOnly(a.heldOn) },
  })
}
