import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  parseSignal,
  validateAnswers,
  type AnswerValue,
  type Audience,
  type EngineQuestion,
  type QuestionFactor,
  type QuestionType,
  type ScoringMethod,
  type ValidateOptions,
} from '../engine'
import { invalid } from '../errors'
import type { Db } from './common'

type QuestionRow = Prisma.CcgQuestionGetPayload<{ include: { options: true } }>

export interface QuestionBank {
  questions: EngineQuestion[]
  rows: QuestionRow[]
  idByKey: Map<string, string>
  keyById: Map<string, string>
}

export function toEngineQuestion(q: QuestionRow): EngineQuestion {
  return {
    key: q.key,
    prompt: q.prompt,
    type: q.type as QuestionType,
    audience: q.audience as Audience,
    required: q.required,
    maxChoices: q.maxChoices,
    factor: q.factor as QuestionFactor | 'none',
    method: q.method as ScoringMethod,
    weight: Number(q.weight),
    active: q.active,
    options: [...q.options]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((o) => ({
        key: o.key,
        label: o.label,
        catchAll: o.catchAll,
        signal: parseSignal(o.signal),
        active: o.active,
      })),
  }
}

/** The whole bank (inactive included — old answers still reference them). */
export async function loadQuestionBank(db: Db = prisma): Promise<QuestionBank> {
  const rows = await db.ccgQuestion.findMany({
    include: { options: true },
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
  })
  return {
    questions: rows.map(toEngineQuestion),
    rows,
    idByKey: new Map(rows.map((r) => [r.key, r.id])),
    keyById: new Map(rows.map((r) => [r.id, r.key])),
  }
}

/** Answers for many people, keyed by person id then question key. */
export async function loadAnswers(
  personIds: string[],
  bank: QuestionBank,
  db: Db = prisma
): Promise<Map<string, Record<string, AnswerValue>>> {
  const out = new Map<string, Record<string, AnswerValue>>(personIds.map((id) => [id, {}]))
  if (personIds.length === 0) return out
  const rows = await db.ccgAnswer.findMany({ where: { personId: { in: personIds } } })
  for (const r of rows) {
    const key = bank.keyById.get(r.questionId)
    if (!key) continue
    out.get(r.personId)![key] = r.value as AnswerValue
  }
  return out
}

/** Suffix for "what did you mean by Other?" text sent alongside an answer: `interests__other`. */
export const OTHER_SUFFIX = '__other'

/** Free text typed after "Other", and the options the AI added from it, keyed by question key. */
export type AnswerNotes = Record<string, { other_text: string | null; ai_keys: string[] }>

export async function loadAnswerNotes(personIds: string[], bank: QuestionBank, db: Db = prisma): Promise<Map<string, AnswerNotes>> {
  const out = new Map<string, AnswerNotes>(personIds.map((id) => [id, {}]))
  if (personIds.length === 0) return out
  const rows = await db.ccgAnswer.findMany({
    where: { personId: { in: personIds }, OR: [{ otherText: { not: null } }, { aiKeys: { not: Prisma.AnyNull } }] },
    select: { personId: true, questionId: true, otherText: true, aiKeys: true },
  })
  for (const r of rows) {
    const key = bank.keyById.get(r.questionId)
    if (!key) continue
    out.get(r.personId)![key] = { other_text: r.otherText, ai_keys: Array.isArray(r.aiKeys) ? (r.aiKeys as string[]) : [] }
  }
  return out
}

const catchAllKeys = (bank: QuestionBank, key: string) =>
  new Set(bank.questions.find((q) => q.key === key)?.options.filter((o) => o.catchAll).map((o) => o.key) ?? [])
const asKeys = (v: AnswerValue | undefined): string[] => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : [])

/**
 * Validate and write answers for one person. Returns whether anything scored
 * changed (so callers know to re-run matching), and whether any "Other" text
 * changed (so the AI can tidy it).
 *
 * `<key>__other` entries carry what was typed after choosing a catch-all
 * option ("Other"). The text is kept only while that option is chosen.
 */
export async function saveAnswers(
  db: Db,
  args: {
    personId: string
    kind: 'member' | 'convert'
    input: Record<string, unknown>
    bank: QuestionBank
    source: 'staff' | 'self'
    userId: string | null
    enforceRequired: boolean
    previous?: Record<string, AnswerValue>
  }
): Promise<{ changed: boolean; otherChanged: boolean }> {
  const input: Record<string, unknown> = {}
  const otherInput = new Map<string, string | null>()
  for (const [k, v] of Object.entries(args.input)) {
    if (k.endsWith(OTHER_SUFFIX)) {
      const text = typeof v === 'string' ? v.trim().slice(0, 200) : ''
      otherInput.set(k.slice(0, -OTHER_SUFFIX.length), text || null)
    } else input[k] = v
  }

  const opts: ValidateOptions = { kind: args.kind, enforceRequired: args.enforceRequired, previous: args.previous }
  const v = validateAnswers(args.bank.questions, input, opts)
  if (!v.ok) throw invalid('Some answers are not valid', { answers: v.errors })

  const existing = new Map(
    (await db.ccgAnswer.findMany({ where: { personId: args.personId }, select: { questionId: true, otherText: true, aiKeys: true } })).map((r) => [
      r.questionId,
      r,
    ])
  )

  for (const [key, value] of Object.entries(v.set)) {
    const questionId = args.bank.idByKey.get(key)!
    // Keep the AI's tags on options that are still chosen.
    const before = existing.get(questionId)
    const kept = Array.isArray(before?.aiKeys) ? (before.aiKeys as string[]).filter((k) => asKeys(value).includes(k)) : null
    await db.ccgAnswer.upsert({
      where: { personId_questionId: { personId: args.personId, questionId } },
      create: {
        personId: args.personId,
        questionId,
        value: value as Prisma.InputJsonValue,
        source: args.source,
        updatedBy: args.userId,
      },
      update: {
        value: value as Prisma.InputJsonValue,
        aiKeys: kept ?? Prisma.DbNull,
        source: args.source,
        updatedBy: args.userId,
        updatedAt: new Date(),
      },
    })
  }
  if (v.cleared.length) {
    await db.ccgAnswer.deleteMany({
      where: { personId: args.personId, questionId: { in: v.cleared.map((k) => args.bank.idByKey.get(k)!) } },
    })
  }

  // "Other" text: kept only while a catch-all option is chosen.
  let otherChanged = false
  for (const key of new Set([...otherInput.keys(), ...Object.keys(v.set)])) {
    const questionId = args.bank.idByKey.get(key)
    if (!questionId || v.cleared.includes(key)) continue
    const current = key in v.set ? v.set[key] : args.previous?.[key]
    const catchAll = catchAllKeys(args.bank, key)
    const chosen = asKeys(current).some((k) => catchAll.has(k))
    const before = existing.get(questionId)?.otherText ?? null
    const next = !chosen ? null : otherInput.has(key) ? otherInput.get(key)! : before
    if (next === before) continue
    const updated = await db.ccgAnswer.updateMany({
      where: { personId: args.personId, questionId },
      data: { otherText: next, aiKeys: Prisma.DbNull },
    })
    if (updated.count) otherChanged = otherChanged || next !== null
  }
  return { changed: Object.keys(v.set).length + v.cleared.length > 0, otherChanged }
}
