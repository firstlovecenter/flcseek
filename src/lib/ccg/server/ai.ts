import Anthropic from '@anthropic-ai/sdk'
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'
import { Prisma } from '@prisma/client'
import { after } from 'next/server'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { ageOn } from '../engine/profile'
import { formatTime12h } from '../engine/meeting-slot'
import { logCcg, unescapeUnicode } from './common'
import { PROPOSABLE_STATUSES, proposeFor, type StoredMatchResults } from './mapping'
import { loadAnswers, loadQuestionBank, type QuestionBank } from './questions'

/**
 * AI help for the CCG app, through Claude:
 *
 *   tidyPerson        "Other" text → the options it means (so it counts in
 *                     matching), and a convert's "who do you know in church?"
 *                     note → that member.
 *   summarisePlacement  a short plain-English "why this CCF" for approvers.
 *
 *   ANTHROPIC_API_KEY  required; without it nothing here runs
 *   CCG_AI_MODEL       optional model override (default claude-haiku-4-5, to keep costs low)
 *   CCG_AI=off         switches it off
 *
 * Everything runs after the response is sent and never throws: when the AI is
 * off or fails, the app works exactly as it does without it.
 */

// Haiku: the cheapest model, and plenty for short notes and tidying answers.
const MODEL = () => process.env.CCG_AI_MODEL || 'claude-haiku-4-5'

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.CCG_AI !== 'off'
}

let client: Anthropic | null = null
const anthropic = () => (client ??= new Anthropic({ timeout: 60_000, maxRetries: 2 }))

/** Run after the response is sent (Next's `after`); outside a request, just in the background. */
export function runLater(task: () => Promise<unknown>) {
  if (!aiConfigured()) return
  const safe = () => task().catch((err) => logger.error('CCG AI task failed:', err))
  try {
    after(safe)
  } catch {
    void safe()
  }
}

/** One structured call. Returns null on refusal, truncation or error. */
async function ask<T>(system: string, input: unknown, schema: Parameters<typeof jsonSchemaOutputFormat>[0], maxTokens = 2000): Promise<T | null> {
  const model = MODEL()
  // Haiku rejects `effort`; and no refusal fallback there, so a decline never re-runs on a pricier model.
  const haiku = model.includes('haiku')
  try {
    const res = await anthropic().beta.messages.parse({
      model,
      max_tokens: maxTokens,
      ...(haiku ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
      output_config: haiku ? { format: jsonSchemaOutputFormat(schema) } : { effort: 'low', format: jsonSchemaOutputFormat(schema) },
      system,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    })
    if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') {
      logger.warn(`CCG AI: stopped with ${res.stop_reason}`)
      return null
    }
    return (res.parsed_output as T | null) ?? null
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) logger.warn('CCG AI: rate limited')
    else if (err instanceof Anthropic.APIError) logger.error(`CCG AI: API error ${err.status}: ${err.message}`)
    else logger.error('CCG AI: request failed:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Tidying free text
// ---------------------------------------------------------------------------

const TIDY_SYSTEM = `You help a church register new people. You get:
- "answers": questions where the person chose "Other" and typed what they meant, with the options available.
- "connection": optionally, a note from a new convert about someone they already know in church, with candidate members.

For each answer, return the option keys that clearly match what they typed (spelling mistakes, slang and abbreviations are fine; e.g. "footbal n gym" means football and gym/fitness). Only use keys from that question's options. Return an empty list when nothing clearly matches; never guess.

For the connection, return the id of the one candidate the note clearly refers to, or null if it is unclear, matches more than one, or none.`

const TIDY_SCHEMA = {
  type: 'object',
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        properties: { question_key: { type: 'string' }, option_keys: { type: 'array', items: { type: 'string' } } },
        required: ['question_key', 'option_keys'],
        additionalProperties: false,
      },
    },
    connection_member_id: { type: ['string', 'null'] },
  },
  required: ['answers', 'connection_member_id'],
  additionalProperties: false,
} as const

interface TidyResult {
  answers: Array<{ question_key: string; option_keys: string[] }>
  connection_member_id: string | null
}

const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-zÀ-ɏ]+/)
    .filter((t) => t.length >= 3)

/** Members whose names share a word with the note (at most 25), from the convert's stream when they have one. */
async function connectionCandidates(note: string, streamId: string | null, selfId: string) {
  const words = tokens(note)
  if (words.length === 0) return []
  const rows = await prisma.ccgPerson.findMany({
    where: {
      kind: 'member',
      status: 'active',
      deletedAt: null,
      id: { not: selfId },
      ...(streamId ? { ccf: { ccg: { streamId } } } : {}),
      OR: words.flatMap((w) => [
        { firstName: { contains: w, mode: 'insensitive' as const } },
        { lastName: { contains: w, mode: 'insensitive' as const } },
        { middleName: { contains: w, mode: 'insensitive' as const } },
      ]),
    },
    select: { id: true, fullName: true, ccf: { select: { name: true } } },
    take: 25,
  })
  return rows.map((r) => ({ id: r.id, name: r.fullName, ccf: r.ccf?.name ?? null }))
}

/**
 * Tidy one person's free text: "Other" answers not yet tidied, and a convert's
 * connection note when no member is linked yet. A convert still waiting for
 * placement is re-matched when anything changed; either way their current
 * proposal gets its summary.
 */
export async function tidyPerson(personId: string) {
  const person = await prisma.ccgPerson.findFirst({ where: { id: personId, deletedAt: null } })
  if (!person) return
  const bank = await loadQuestionBank()
  const rows = await prisma.ccgAnswer.findMany({
    where: { personId, otherText: { not: null }, aiKeys: { equals: Prisma.AnyNull } },
    select: { id: true, questionId: true, value: true, otherText: true },
  })
  const pending = rows
    .map((r) => {
      const q = bank.questions.find((x) => x.key === bank.keyById.get(r.questionId))
      if (!q || (q.type !== 'single' && q.type !== 'multi')) return null
      const options = q.options.filter((o) => o.active && !o.catchAll)
      return { row: r, q, options }
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.options.length > 0)

  const note = person.kind === 'convert' && !person.existingConnectionMemberId ? person.existingConnectionNote?.trim() : null
  const candidates = note ? await connectionCandidates(note, person.streamId, person.id) : []

  if (pending.length === 0 && candidates.length === 0) {
    if (person.kind === 'convert') await summariseCurrentProposal(personId)
    return
  }

  const result = await ask<TidyResult>(TIDY_SYSTEM, {
    answers: pending.map((p) => ({
      question_key: p.q.key,
      question: p.q.prompt,
      typed: p.row.otherText,
      options: p.options.map((o) => ({ key: o.key, label: o.label })),
    })),
    ...(candidates.length ? { connection: { note, candidates } } : {}),
  }, TIDY_SCHEMA)

  let changed = false
  const applied: Record<string, string[]> = {}
  for (const p of pending) {
    const valid = new Set(p.options.map((o) => o.key))
    const suggested = [...new Set(result?.answers.find((a) => a.question_key === p.q.key)?.option_keys ?? [])].filter((k) => valid.has(k))
    const current = Array.isArray(p.row.value) ? (p.row.value as string[]) : typeof p.row.value === 'string' ? [p.row.value] : []
    let next = current
    let added: string[] = []
    if (p.q.type === 'multi') {
      const room = Math.max((p.q.maxChoices ?? Infinity) - current.length, 0)
      added = suggested.filter((k) => !current.includes(k)).slice(0, room)
      next = [...current, ...added]
    } else if (suggested[0] && current.every((k) => p.q.options.find((o) => o.key === k)?.catchAll)) {
      added = [suggested[0]]
      next = added
    }
    // Recorded even when nothing matched, so the same text is not sent again.
    if (!result) continue
    await prisma.ccgAnswer.update({
      where: { id: p.row.id },
      data: {
        value: (p.q.type === 'single' ? next[0] : next) as Prisma.InputJsonValue,
        aiKeys: added as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    })
    if (added.length) {
      changed = true
      applied[p.q.key] = added
    }
  }

  const memberId = result?.connection_member_id
  const connected = memberId && candidates.some((c) => c.id === memberId) ? memberId : null
  if (connected) {
    await prisma.ccgPerson.update({ where: { id: personId }, data: { existingConnectionMemberId: connected, connectionByAi: true, updatedAt: new Date() } })
    changed = true
  }
  if (changed) {
    await logCcg({ userId: null, action: 'AI_TIDIED', entityType: 'ccg_person', entityId: personId, newValues: { added: applied, connection_member_id: connected } })
  }

  if (person.kind !== 'convert') return
  const now = await prisma.ccgPerson.findUnique({ where: { id: personId }, select: { status: true } })
  if (changed && now && (PROPOSABLE_STATUSES as readonly string[]).includes(now.status)) {
    await proposeFor(personId, 'answers_changed', null) // schedules its own summary
  } else {
    await summariseCurrentProposal(personId)
  }
}

/** Does this person have free text for the AI to tidy? */
export async function needsTidy(personId: string): Promise<boolean> {
  if (!aiConfigured()) return false
  const [p, other] = await Promise.all([
    prisma.ccgPerson.findUnique({ where: { id: personId }, select: { kind: true, existingConnectionNote: true, existingConnectionMemberId: true } }),
    prisma.ccgAnswer.count({ where: { personId, otherText: { not: null }, aiKeys: { equals: Prisma.AnyNull } } }),
  ])
  return other > 0 || (p?.kind === 'convert' && !!p.existingConnectionNote?.trim() && !p.existingConnectionMemberId)
}

// ---------------------------------------------------------------------------
// Approver summaries
// ---------------------------------------------------------------------------

const SUMMARY_SYSTEM = `You write a short note for a church leader approving where a new convert is placed. The matching engine has already chosen the proposed City Church Family (CCF): it is Option 1. The leader approves it or chooses another.

Write the note in this shape:
1. Start with "Option 1, <CCF name>," then, in one or two plain sentences, at most 40 words, say why it fits this person, using the concrete things they share (interests, when they meet, age, someone they know). Mention a caution briefly if there is one. Do not name or compare other CCFs here.
2. Only if alternatives are given, a final sentence listing them as backups by their option number, e.g. "Other options: Option 2, <name> (<what they share, a few words>); Option 3, <name> (<...>)."

Never present the alternatives as competing with or better than Option 1. No scores, percentages or jargon; don't invent anything not in the data; don't use the person's name. Write plain characters (an em dash as —, never an escape code like \\u2014).`
const SUMMARY_SCHEMA = {
  type: 'object',
  properties: { summary: { type: 'string' } },
  required: ['summary'],
  additionalProperties: false,
} as const

function describeAnswers(answers: Record<string, unknown>, bank: QuestionBank) {
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(answers)) {
    const q = bank.questions.find((x) => x.key === key)
    if (!q || q.factor === 'none') continue
    const label = (k: string) => q.options.find((o) => o.key === k)?.label ?? k
    out[q.prompt] = typeof value === 'number' ? value : Array.isArray(value) ? value.map(label).join(', ') : label(String(value))
  }
  return out
}

async function summariseCurrentProposal(personId: string) {
  const p = await prisma.ccgPlacement.findFirst({ where: { personId, status: 'proposed', aiSummaryAt: null }, select: { id: true } })
  if (p) await summarisePlacement(p.id)
}

/** Write the approver's summary for a proposed placement (once). */
export async function summarisePlacement(placementId: string) {
  const p = await prisma.ccgPlacement.findUnique({
    where: { id: placementId },
    include: {
      person: { include: { existingConnection: { select: { ccfId: true } } } },
      proposedCcf: { include: { ccg: true } },
      matchRun: { select: { results: true } },
    },
  })
  if (!p || p.status !== 'proposed' || p.aiSummaryAt || !p.proposedCcf) return
  const bank = await loadQuestionBank()
  const answers = (await loadAnswers([p.personId], bank)).get(p.personId) ?? {}
  const results = p.matchRun?.results as StoredMatchResults | null
  const top = results?.top ?? []
  const proposed = top.find((u) => u.ccf_id === p.proposedCcfId)
  const f = p.proposedCcf

  const out = await ask<{ summary: string }>(
    SUMMARY_SYSTEM,
    {
      convert: {
        age: ageOn(p.person.dateOfBirth),
        gender: p.person.gender,
        answers: describeAnswers(answers, bank),
        knows_someone_in_this_ccf: p.person.existingConnection?.ccfId === f.id,
      },
      option_1_proposed_ccf: {
        option: 1,
        name: f.name,
        ccg: f.ccg.name,
        meets: [f.meetingDay, f.meetingTime ? formatTime12h(f.meetingTime) : null].filter(Boolean).join(' ') || null,
        members: proposed?.member_count ?? null,
        open_places: proposed?.available_spaces ?? null,
        reasons: proposed?.reasons ?? [],
        cautions: proposed?.cautions ?? [],
        fit_out_of_100: proposed?.overall ?? null,
      },
      alternatives: top
        .filter((u) => u.ccf_id !== p.proposedCcfId)
        .slice(0, 2)
        .map((u, i) => ({ option: i + 2, name: u.ccf_name, fit_out_of_100: u.overall, reasons: u.reasons })),
      warnings: results?.warnings ?? [],
    },
    SUMMARY_SCHEMA,
    1000
  )
  await prisma.ccgPlacement.updateMany({
    where: { id: placementId, aiSummaryAt: null },
    data: { aiSummary: out ? unescapeUnicode(out.summary.trim()) || null : null, aiSummaryAt: new Date() },
  })
}

/** Proposals in the approval queue still without a summary (e.g. made before the AI was switched on). */
export function backfillSummaries(placements: Array<{ id: string; status: string; ai_summary_at?: string | null }>, max = 5) {
  if (!aiConfigured()) return
  const todo = placements.filter((p) => p.status === 'proposed' && !p.ai_summary_at).slice(0, max)
  if (todo.length) runLater(async () => {
    for (const p of todo) await summarisePlacement(p.id)
  })
}
