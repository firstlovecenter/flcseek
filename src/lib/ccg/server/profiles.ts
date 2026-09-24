import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ageOn,
  aggregateMembers,
  buildCcfProfile,
  type AnswerValue,
  type CcfProfile,
  type CcgConfig,
  type EnginePerson,
  type EngineUnit,
  type MemberAggregate,
} from '../engine'
import { zoneLabel, type Db } from './common'
import { loadAnswers, type QuestionBank } from './questions'

type PersonRow = Prisma.CcgPersonGetPayload<object>

export function toEnginePerson(p: PersonRow, answers: Record<string, AnswerValue>, today = new Date()): EnginePerson {
  return {
    id: p.id,
    kind: p.kind === 'member' ? 'member' : 'convert',
    gender: p.gender,
    age: ageOn(p.dateOfBirth, today),
    zoneId: p.zoneId,
    answers,
    existingConnectionMemberId: p.existingConnectionMemberId,
  }
}

const unitInclude = { zone: true, ccg: { include: { zone: true } } } satisfies Prisma.CcgFamilyInclude
type UnitRow = Prisma.CcgFamilyGetPayload<{ include: typeof unitInclude }>

export function toEngineUnit(f: UnitRow): EngineUnit {
  const zone = f.zone ?? f.ccg.zone
  return {
    id: f.id,
    code: f.code,
    name: f.name,
    ccgId: f.ccgId,
    ccgCode: f.ccg.code,
    ccgName: f.ccg.name,
    zoneId: zone?.id ?? null,
    zoneLabel: zoneLabel(zone),
    meetingDay: f.meetingDay,
    meetingTime: f.meetingTime,
    capacity: f.capacity,
    status: f.status,
    ccgStatus: f.ccg.status,
    audience: f.ccg.audience === 'youth' ? 'youth' : 'adult',
  }
}

export interface LoadedProfiles {
  profiles: CcfProfile[]
  byCcf: Map<string, CcfProfile>
  ccgAggregates: Map<string, MemberAggregate>
}

/**
 * Build CCF profiles from live data.
 * @param ccfIds limit to these CCFs (their CCG aggregates still use every CCF in the CCG)
 * @param excludePersonId the convert being matched: their own open proposal does not reserve a seat
 */
export async function loadProfiles(opts: {
  bank: QuestionBank
  config: CcgConfig
  ccfIds?: string[]
  excludePersonId?: string
  db?: Db
}): Promise<LoadedProfiles> {
  const db = opts.db ?? prisma
  const liveUnit = { deletedAt: null, ccg: { deletedAt: null } } satisfies Prisma.CcgFamilyWhereInput

  const units = await db.ccgFamily.findMany({
    where: { ...liveUnit, ...(opts.ccfIds ? { id: { in: opts.ccfIds } } : {}) },
    include: unitInclude,
    orderBy: { code: 'asc' },
  })
  if (units.length === 0) return { profiles: [], byCcf: new Map(), ccgAggregates: new Map() }

  const ccgIds = [...new Set(units.map((u) => u.ccgId))]
  const siblingUnits = await db.ccgFamily.findMany({
    where: { ...liveUnit, ccgId: { in: ccgIds } },
    select: { id: true, ccgId: true },
  })
  const ccgOf = new Map(siblingUnits.map((u) => [u.id, u.ccgId]))
  const allCcfIds = siblingUnits.map((u) => u.id)

  const [members, active, reserved] = await Promise.all([
    db.ccgPerson.findMany({
      where: { kind: 'member', status: 'active', deletedAt: null, ccfId: { in: allCcfIds } },
    }),
    db.ccgPlacement.groupBy({
      by: ['finalCcfId'],
      where: { status: 'active', finalCcfId: { in: allCcfIds }, person: { deletedAt: null } },
      _count: { _all: true },
    }),
    db.ccgPlacement.groupBy({
      by: ['proposedCcfId'],
      where: {
        status: 'proposed',
        proposedCcfId: { in: allCcfIds },
        person: { deletedAt: null },
        ...(opts.excludePersonId ? { personId: { not: opts.excludePersonId } } : {}),
      },
      _count: { _all: true },
    }),
  ])

  const answers = await loadAnswers(members.map((m) => m.id), opts.bank, db)
  const today = new Date()
  const byUnit = new Map<string, EnginePerson[]>()
  const byCcg = new Map<string, EnginePerson[]>()
  for (const m of members) {
    const ep = toEnginePerson(m, answers.get(m.id) ?? {}, today)
    byUnit.set(m.ccfId!, [...(byUnit.get(m.ccfId!) ?? []), ep])
    const ccgId = ccgOf.get(m.ccfId!)!
    byCcg.set(ccgId, [...(byCcg.get(ccgId) ?? []), ep])
  }

  const ccgAggregates = new Map<string, MemberAggregate>()
  for (const id of ccgIds) ccgAggregates.set(id, aggregateMembers(byCcg.get(id) ?? [], opts.bank.questions))

  const activeCount = new Map(active.map((a) => [a.finalCcfId!, a._count._all]))
  const reservedCount = new Map(reserved.map((r) => [r.proposedCcfId!, r._count._all]))

  const profiles = units.map((u) =>
    buildCcfProfile(
      {
        unit: toEngineUnit(u),
        members: byUnit.get(u.id) ?? [],
        ccgAggregate: ccgAggregates.get(u.ccgId)!,
        activePlacements: activeCount.get(u.id) ?? 0,
        reserved: reservedCount.get(u.id) ?? 0,
      },
      opts.bank.questions,
      opts.config
    )
  )
  return { profiles, byCcf: new Map(profiles.map((p) => [p.unit.id, p])), ccgAggregates }
}
