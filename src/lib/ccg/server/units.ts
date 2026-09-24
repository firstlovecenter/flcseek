import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { CcfProfile, MemberAggregate, QuestionAggregate } from '../engine'
import { conflict, invalid, notFound } from '../errors'
import { iso } from './common'
import type { QuestionBank } from './questions'

/** Council → CCG → CCF serialisation, profiles and structural guards. */

export function serializeCouncil(c: Prisma.CcgCouncilGetPayload<object>, extra: { ccg_count?: number } = {}) {
  return { id: c.id, stream_id: c.streamId, code: c.code, name: c.name, status: c.status, notes: c.notes, ...extra, created_at: iso(c.createdAt) }
}

export async function assertStreamExists(id: string | null | undefined) {
  if (!id) return
  if (!(await prisma.ccgStream.findFirst({ where: { id, deletedAt: null } }))) throw invalid('Stream not found')
}

export const ccgInclude = { council: true } satisfies Prisma.CcgGroupInclude
export function serializeCcg(g: Prisma.CcgGroupGetPayload<{ include: typeof ccgInclude }>, extra: Record<string, unknown> = {}) {
  return {
    id: g.id,
    code: g.code,
    name: g.name,
    council: g.council ? { id: g.council.id, code: g.council.code, name: g.council.name } : null,
    audience: g.audience,
    status: g.status,
    notes: g.notes,
    ...extra,
    created_at: iso(g.createdAt),
  }
}

export const ccfInclude = { ccg: true } satisfies Prisma.CcgFamilyInclude
export function serializeCcf(f: Prisma.CcgFamilyGetPayload<{ include: typeof ccfInclude }>, extra: Record<string, unknown> = {}) {
  return {
    id: f.id,
    code: f.code,
    name: f.name,
    ccg: { id: f.ccg.id, code: f.ccg.code, name: f.ccg.name, audience: f.ccg.audience, status: f.ccg.status },
    meeting_location: f.meetingLocation,
    meeting_day: f.meetingDay,
    meeting_time: f.meetingTime,
    meeting_frequency: f.meetingFrequency,
    capacity: f.capacity,
    status: f.status,
    notes: f.notes,
    ...extra,
    created_at: iso(f.createdAt),
  }
}

/** Human-readable summary of an aggregate: top options / means per scored question. */
function summarise(questions: Record<string, QuestionAggregate>, bank: QuestionBank, top = 5) {
  const out: Array<Record<string, unknown>> = []
  for (const q of bank.questions) {
    if (!q.active || q.type === 'text') continue
    const a = questions[q.key]
    if (!a) continue
    if (a.kind === 'choice') {
      const options = Object.entries(a.shares)
        .filter(([, s]) => s > 0)
        .sort((x, y) => y[1] - x[1])
        .slice(0, top)
        .map(([key, share]) => ({ key, label: q.options.find((o) => o.key === key)?.label ?? key, share: Math.round(share * 1000) / 1000 }))
      out.push({ question: q.key, prompt: q.prompt, kind: 'choice', respondents: a.n, top: options })
    } else {
      out.push({ question: q.key, prompt: q.prompt, kind: 'scale', respondents: a.n, mean: a.mean === null ? null : Math.round(a.mean * 100) / 100 })
    }
  }
  return out
}

export function serializeProfile(p: CcfProfile, bank: QuestionBank) {
  return {
    member_count: p.own.memberCount,
    occupied: p.occupied,
    reserved: p.reserved,
    available_spaces: p.availableSpaces,
    capacity_status: p.capacityStatus,
    health: p.health,
    age: { source: p.ageSource, median: p.medianAge, min: p.minAge, max: p.maxAge },
    gender_mix: p.own.genderMix,
    meeting_slot: p.meetingSlotLabel,
    social_mean: p.socialMean === null ? null : Math.round(p.socialMean * 100) / 100,
    /** What the matcher uses: the CCF blended with its CCG. */
    matching_profile: summarise(p.blended, bank),
    /** The CCF's own members only. */
    own_profile: summarise(p.own.questions, bank),
  }
}

export function serializeAggregate(a: MemberAggregate, bank: QuestionBank) {
  const ages = a.ages
  return {
    member_count: a.memberCount,
    gender_mix: a.genderMix,
    age: { min: ages[0] ?? null, max: ages[ages.length - 1] ?? null },
    profile: summarise(a.questions, bank),
  }
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export async function assertCouncilExists(id: string | null | undefined) {
  if (!id) return
  if (!(await prisma.ccgCouncil.findFirst({ where: { id, deletedAt: null } }))) throw invalid('Council not found')
}

export async function assertCcgExists(id: string) {
  const g = await prisma.ccgGroup.findFirst({ where: { id, deletedAt: null } })
  if (!g) throw notFound('CCG')
  return g
}

/** Capacity may not drop below the people already in the CCF. */
export async function assertCapacityFits(ccfId: string, capacity: number) {
  const [members, placed] = await Promise.all([
    prisma.ccgPerson.count({ where: { kind: 'member', status: 'active', deletedAt: null, ccfId } }),
    prisma.ccgPlacement.count({ where: { status: 'active', finalCcfId: ccfId, person: { deletedAt: null } } }),
  ])
  if (capacity < members + placed) {
    throw invalid(`Capacity cannot be below the ${members + placed} people already in this CCF`)
  }
}

export async function assertCcfEmpty(ccfId: string) {
  const [members, placements] = await Promise.all([
    prisma.ccgPerson.count({ where: { ccfId, deletedAt: null } }),
    prisma.ccgPlacement.count({ where: { status: { in: ['active', 'proposed'] }, OR: [{ finalCcfId: ccfId }, { proposedCcfId: ccfId }] } }),
  ])
  if (members + placements > 0) throw conflict('Move or remove everyone in this CCF (members, placements and proposals) first')
}
