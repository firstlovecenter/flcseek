import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { rankUnits, type CcgConfig, type ScoredUnit } from '../engine'
import { notFound } from '../errors'
import { ccgTx, getCcgConfig, logCcg, type Tx } from './common'
import { loadProfiles, toEnginePerson } from './profiles'
import { loadAnswers, loadQuestionBank } from './questions'

export type MatchTrigger = 'registration' | 'answers_changed' | 'rescore' | 'manual'

/** Convert statuses that can receive a (new) proposal. */
export const PROPOSABLE_STATUSES = ['new', 'proposed', 'needs_info'] as const

export interface ScoredUnitDTO {
  ccf_id: string
  ccf_code: string
  ccf_name: string
  ccg_id: string
  ccg_code: string
  ccg_name: string
  overall: number
  factors: ScoredUnit['factors']
  reasons: string[]
  cautions: string[]
  eligible: boolean
  ineligible_reasons: ScoredUnit['ineligibleReasons']
  available_spaces: number
  capacity: number
  member_count: number
}

export interface StoredMatchResults {
  top: ScoredUnitDTO[]
  eligible: ScoredUnitDTO[]
  ineligible: ScoredUnitDTO[]
  warnings: string[]
}

export function serializeScored(u: ScoredUnit): ScoredUnitDTO {
  return {
    ccf_id: u.ccfId,
    ccf_code: u.ccfCode,
    ccf_name: u.ccfName,
    ccg_id: u.ccgId,
    ccg_code: u.ccgCode,
    ccg_name: u.ccgName,
    overall: u.overall,
    factors: u.factors,
    reasons: u.reasons,
    cautions: u.cautions,
    eligible: u.eligible,
    ineligible_reasons: u.ineligibleReasons,
    available_spaces: u.availableSpaces,
    capacity: u.capacity,
    member_count: u.memberCount,
  }
}

/** Lock a row for the rest of the transaction (serialises concurrent writers). */
export async function lockRow(tx: Tx, table: 'ccg_people' | 'ccg_families', id: string) {
  if (table === 'ccg_people') await tx.$queryRaw`SELECT id FROM ccg_people WHERE id = ${id}::uuid FOR UPDATE`
  else await tx.$queryRaw`SELECT id FROM ccg_families WHERE id = ${id}::uuid FOR UPDATE`
}

/** CCFs in a stream (stream → council → CCG → CCF). */
async function streamCcfIds(streamId: string): Promise<string[]> {
  const rows = await prisma.ccgFamily.findMany({
    where: { deletedAt: null, ccg: { deletedAt: null, council: { deletedAt: null, streamId } } },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

/**
 * Score one convert against every CCF (no writes). A convert registered into
 * a stream is only matched against that stream's CCFs, so the stream's Sheep
 * Seekers can approve what is proposed.
 */
export async function scoreConvert(personId: string, config?: CcgConfig) {
  const person = await prisma.ccgPerson.findFirst({ where: { id: personId, deletedAt: null } })
  if (!person) throw notFound('Person')
  const cfg = config ?? (await getCcgConfig())
  const bank = await loadQuestionBank()
  const ccfIds = person.kind === 'convert' && person.streamId ? await streamCcfIds(person.streamId) : undefined
  const [answers, { profiles }] = await Promise.all([
    loadAnswers([personId], bank),
    ccfIds?.length === 0
      ? Promise.resolve({ profiles: [] })
      : loadProfiles({ bank, config: cfg, excludePersonId: personId, ccfIds }),
  ])
  const result = rankUnits(toEnginePerson(person, answers.get(personId) ?? {}), profiles, {
    config: cfg,
    questions: bank.questions,
  })
  if (ccfIds?.length === 0) {
    result.warnings = result.warnings.map((w) => (w === 'No CCFs have been set up yet.' ? 'No CCFs have been set up in this stream yet.' : w))
  }
  return { person, config: cfg, result }
}

/**
 * Real-time mapping. Scores the convert, stores the run, and replaces any open
 * proposal with a new one for the #1 eligible CCF — or a 'held' placement when
 * nothing is eligible. Placed / integrated / inactive converts and members are
 * left alone (returns null).
 */
export async function proposeFor(personId: string, trigger: MatchTrigger, actorId: string | null) {
  const { person, config, result } = await scoreConvert(personId)
  if (person.kind !== 'convert' || !(PROPOSABLE_STATUSES as readonly string[]).includes(person.status)) return null

  const stored: StoredMatchResults = {
    top: result.top.map(serializeScored),
    eligible: result.eligible.map(serializeScored),
    ineligible: result.ineligible.map(serializeScored),
    warnings: result.warnings,
  }
  const [t1, t2, t3] = result.top

  const out = await ccgTx(async (tx) => {
    await lockRow(tx, 'ccg_people', personId)
    const fresh = await tx.ccgPerson.findUnique({ where: { id: personId } })
    if (!fresh || fresh.deletedAt || !(PROPOSABLE_STATUSES as readonly string[]).includes(fresh.status)) return null

    const run = await tx.ccgMatchRun.create({
      data: {
        personId,
        trigger,
        runBy: actorId,
        configSnapshot: config as unknown as Prisma.InputJsonValue,
        results: stored as unknown as Prisma.InputJsonValue,
        top1CcfId: t1?.ccfId ?? null,
        top1Score: t1?.overall ?? null,
        top2CcfId: t2?.ccfId ?? null,
        top2Score: t2?.overall ?? null,
        top3CcfId: t3?.ccfId ?? null,
        top3Score: t3?.overall ?? null,
      },
    })
    await tx.ccgPlacement.updateMany({
      where: { personId, status: { in: ['proposed', 'held'] } },
      data: { status: 'superseded', updatedAt: new Date() },
    })
    const placement = await tx.ccgPlacement.create({
      data: t1
        ? { personId, matchRunId: run.id, proposedCcfId: t1.ccfId, proposedScore: t1.overall, status: 'proposed' }
        : {
            personId,
            matchRunId: run.id,
            status: 'held',
            holdReason: result.warnings.join(' ') || 'No eligible CCF available.',
          },
    })
    await tx.ccgPerson.update({
      where: { id: personId },
      data: { status: t1 ? 'proposed' : 'needs_info', updatedAt: new Date() },
    })
    await logCcg(
      {
        userId: actorId,
        action: t1 ? 'PLACEMENT_PROPOSED' : 'PLACEMENT_HELD_NO_MATCH',
        entityType: 'ccg_placement',
        entityId: placement.id,
        newValues: { person_id: personId, trigger, top: result.top.map((u) => ({ ccf: u.ccfCode, score: u.overall })) },
      },
      tx
    )
    return { run, placement }
  })
  return out
}
