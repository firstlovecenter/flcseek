import type { Prisma } from '@prisma/client'
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

/**
 * Validate and write answers for one person. Returns whether anything scored
 * changed (so callers know to re-run matching).
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
): Promise<{ changed: boolean }> {
  const opts: ValidateOptions = { kind: args.kind, enforceRequired: args.enforceRequired, previous: args.previous }
  const v = validateAnswers(args.bank.questions, args.input, opts)
  if (!v.ok) throw invalid('Some answers are not valid', { answers: v.errors })

  for (const [key, value] of Object.entries(v.set)) {
    const questionId = args.bank.idByKey.get(key)!
    await db.ccgAnswer.upsert({
      where: { personId_questionId: { personId: args.personId, questionId } },
      create: {
        personId: args.personId,
        questionId,
        value: value as Prisma.InputJsonValue,
        source: args.source,
        updatedBy: args.userId,
      },
      update: { value: value as Prisma.InputJsonValue, source: args.source, updatedBy: args.userId, updatedAt: new Date() },
    })
  }
  if (v.cleared.length) {
    await db.ccgAnswer.deleteMany({
      where: { personId: args.personId, questionId: { in: v.cleared.map((k) => args.bank.idByKey.get(k)!) } },
    })
  }
  return { changed: Object.keys(v.set).length + v.cleared.length > 0 }
}
