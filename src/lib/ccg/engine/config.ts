import { z } from 'zod'

/**
 * Matching configuration. Stored as JSON in ccg_settings.config and merged over
 * DEFAULT_CCG_CONFIG, so a partial or stale row still yields a complete, valid
 * config. Weights apply to the eight factor buckets; questions in the question
 * bank are assigned to a bucket and weighted within it.
 */

export const FACTORS = [
  'interests',
  'friendship',
  'social',
  'age',
  'availability',
  'location',
  'profession',
  'connection',
] as const
export type Factor = (typeof FACTORS)[number]

/** Factors fed by questions; the rest come from core person fields. */
export const QUESTION_FACTORS = ['interests', 'friendship', 'social', 'availability', 'profession'] as const
export type QuestionFactor = (typeof QUESTION_FACTORS)[number]

export const FACTOR_LABELS: Record<Factor, string> = {
  interests: 'Shared interests',
  friendship: 'Friendship preferences',
  social: 'Social style',
  age: 'Age / life stage',
  availability: 'Meeting availability',
  location: 'Location',
  profession: 'Line of work',
  connection: 'Existing relationship',
}

const score = z.number().min(0).max(100)
const pair = <A extends string, B extends string>(a: A, b: B) => z.object({ [a]: score, [b]: score } as Record<A | B, typeof score>)

export const ccgConfigSchema = z
  .object({
    /** Percentages; must total 100. */
    weights: z.object(Object.fromEntries(FACTORS.map((f) => [f, z.number().min(0).max(100)])) as Record<Factor, z.ZodNumber>),
    /** Mean age gap to members → score. Ascending maxDiff. */
    ageBands: z.array(z.object({ maxDiff: z.number().min(0), score })).min(1),
    location: pair('same', 'different'),
    /** `same_answer` questions: someone in the group shares the answer, or not. */
    sameAnswer: pair('match', 'noMatch'),
    /** `meeting_slot` questions: the CCF meets when the convert is free, or not. */
    availability: pair('match', 'noMatch'),
    connection: pair('inGroup', 'notInGroup'),
    /** Share of members holding an option at which it counts as a full hit. */
    targetShare: z.number().gt(0).max(1),
    /** A `similar` preference is fully satisfied at this factor score. */
    similarThreshold: score,
    highTraitThreshold: z.number().min(1).max(5),
    lowTraitThreshold: z.number().min(1).max(5),
    /** CCF profile = (n·ccf + k·ccg)/(n+k). 0 disables blending with the CCG. */
    smoothing: z.number().min(0).max(50),
    /** Fewer active members than this → below minimum / critical. */
    minMembers: z.number().int().min(0),
    /** May an admin approve into a full CCF (with a reason)? */
    allowFullOverride: z.boolean(),
    /** Each convert's retention assessment runs this many days from approval. */
    assessmentDays: z.number().int().min(30).max(1095),
    /** Factor score at/above which it is cited as a reason. */
    reasonThresholds: z.object(Object.fromEntries(FACTORS.map((f) => [f, score])) as Record<Factor, typeof score>),
  })
  .refine((c) => Math.abs(FACTORS.reduce((s, f) => s + c.weights[f], 0) - 100) < 0.01, {
    message: 'Weights must total 100',
    path: ['weights'],
  })

export type CcgConfig = z.infer<typeof ccgConfigSchema>

export const DEFAULT_CCG_CONFIG: CcgConfig = {
  weights: {
    interests: 25,
    friendship: 15,
    social: 15,
    age: 10,
    availability: 10,
    location: 10,
    profession: 5,
    connection: 10,
  },
  ageBands: [
    { maxDiff: 2, score: 100 },
    { maxDiff: 5, score: 80 },
    { maxDiff: 9, score: 60 },
    { maxDiff: 14, score: 40 },
    { maxDiff: 999, score: 20 },
  ],
  location: { same: 100, different: 40 },
  sameAnswer: { match: 100, noMatch: 30 },
  availability: { match: 100, noMatch: 0 },
  connection: { inGroup: 100, notInGroup: 0 },
  targetShare: 0.5,
  similarThreshold: 50,
  highTraitThreshold: 4,
  lowTraitThreshold: 3,
  smoothing: 3,
  minMembers: 3,
  allowFullOverride: false,
  assessmentDays: 365,
  reasonThresholds: {
    interests: 60,
    friendship: 60,
    social: 70,
    age: 80,
    availability: 100,
    location: 100,
    profession: 100,
    connection: 100,
  },
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : override) as T
  }
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined) continue
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v
  }
  return out as T
}

/** Stored config merged over defaults; falls back to defaults if invalid. */
export function resolveCcgConfig(stored: unknown): CcgConfig {
  const parsed = ccgConfigSchema.safeParse(deepMerge(DEFAULT_CCG_CONFIG, stored ?? {}))
  if (!parsed.success) return DEFAULT_CCG_CONFIG
  return { ...parsed.data, ageBands: [...parsed.data.ageBands].sort((a, b) => a.maxDiff - b.maxDiff) }
}
