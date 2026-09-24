import { z } from 'zod'
import { QUESTION_FACTORS, type CcgConfig } from './config'

/**
 * A friendship-preference option carries a `signal`: what the group must show
 * for the preference to be satisfied. Signals are data (ccg_question_options.
 * signal), so admins can add preferences without code changes.
 *
 *  option_share  share of members holding any of `refs` ("questionKey:optionKey")
 *  trait         group mean on scale question(s) is high / low
 *  age           the age-fit factor score
 *  similar       another factor's score (e.g. interests) against a threshold
 *  same_answer   share of members who gave the convert's own answer to `question`
 *  neutral       "fits any group" — not scored at all
 */
export const signalSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('option_share'),
    refs: z.array(z.string().regex(/^[a-z0-9_]+:[a-z0-9_]+$/, 'Use questionKey:optionKey')).min(1),
  }),
  z.object({
    type: z.literal('trait'),
    questions: z.array(z.string().min(1)).min(1),
    direction: z.enum(['high', 'low']),
  }),
  z.object({ type: z.literal('age') }),
  z.object({ type: z.literal('similar'), factor: z.enum(QUESTION_FACTORS) }),
  z.object({ type: z.literal('same_answer'), question: z.string().min(1) }),
  z.object({ type: z.literal('neutral') }),
])
export type Signal = z.infer<typeof signalSchema>

/** For admin UIs: what each signal type needs. */
export const SIGNAL_TYPES = {
  option_share: { label: 'Group holds any of these options', fields: ['refs'] },
  trait: { label: 'Group is high / low on a scale question', fields: ['questions', 'direction'] },
  age: { label: 'Group is close in age', fields: [] },
  similar: { label: 'Group scores well on another factor', fields: ['factor'] },
  same_answer: { label: "Group shares the convert's answer to a question", fields: ['question'] },
  neutral: { label: 'Fits any group (not scored)', fields: [] },
} as const

export function parseSignal(value: unknown): Signal | null {
  const parsed = signalSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** 1 → 0, ≥highThreshold → 100, linear between. */
export function highTraitScore(mean: number | null, config: CcgConfig): number | null {
  if (mean === null) return null
  const span = config.highTraitThreshold - 1
  if (span <= 0) return mean >= config.highTraitThreshold ? 100 : 0
  return clamp01((mean - 1) / span) * 100
}

/** ≤lowThreshold → 100, 5 → 0, linear between. */
export function lowTraitScore(mean: number | null, config: CcgConfig): number | null {
  if (mean === null) return null
  const span = 5 - config.lowTraitThreshold
  if (span <= 0) return mean <= config.lowTraitThreshold ? 100 : 0
  return clamp01((5 - mean) / span) * 100
}

export interface SignalContext {
  config: CcgConfig
  /** Blended share of members holding any of the refs (0–1). */
  unionShare: (refs: string[]) => number
  /** Blended mean of a scale question, or null. */
  scaleMean: (questionKey: string) => number | null
  /** Blended share of an option of a choice question (0–1). */
  optionShare: (questionKey: string, optionKey: string) => number
  /** The convert's single answer to a question, if any (catch-all excluded). */
  convertAnswer: (questionKey: string) => string | null
  ageScore: number | null
  factorScore: (factor: string) => number | null
  hasMembers: boolean
}

/** 0–100, or null when the signal cannot be judged (dropped from the mean). */
export function scoreSignal(signal: Signal, ctx: SignalContext): number | null {
  if (signal.type === 'neutral') return null
  if (!ctx.hasMembers) return 0
  const fromShare = (share: number) => clamp01(share / ctx.config.targetShare) * 100

  switch (signal.type) {
    case 'option_share':
      return fromShare(ctx.unionShare(signal.refs))
    case 'trait': {
      const means = signal.questions.map(ctx.scaleMean).filter((m): m is number => m !== null)
      if (means.length === 0) return null
      const mean = means.reduce((a, b) => a + b, 0) / means.length
      return signal.direction === 'high' ? highTraitScore(mean, ctx.config) : lowTraitScore(mean, ctx.config)
    }
    case 'age':
      return ctx.ageScore
    case 'similar': {
      const s = ctx.factorScore(signal.factor)
      return s === null ? null : clamp01(s / Math.max(1, ctx.config.similarThreshold)) * 100
    }
    case 'same_answer': {
      const answer = ctx.convertAnswer(signal.question)
      return answer === null ? null : fromShare(ctx.optionShare(signal.question, answer))
    }
  }
}
