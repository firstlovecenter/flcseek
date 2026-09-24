import type { Factor, QuestionFactor } from './config'
import type { Signal } from './signals'

/** Pure engine types — no Prisma. The service maps rows onto these. */

export type QuestionType = 'single' | 'multi' | 'scale5' | 'text'
export type ScoringMethod = 'share' | 'same_answer' | 'distance' | 'meeting_slot' | 'preference' | 'none'
export type Audience = 'member' | 'convert' | 'both'

export interface EngineOption {
  key: string
  label: string
  catchAll: boolean
  signal: Signal | null
  active: boolean
}

export interface EngineQuestion {
  key: string
  prompt: string
  type: QuestionType
  audience: Audience
  required: boolean
  maxChoices: number | null
  factor: QuestionFactor | 'none'
  method: ScoringMethod
  weight: number
  active: boolean
  options: EngineOption[]
}

/** single: option key · multi: option keys · scale5: 1..5 · text: string */
export type AnswerValue = string | string[] | number

export interface EnginePerson {
  id: string
  kind: 'member' | 'convert'
  gender: string | null
  /** Whole years, from date_of_birth at request time. */
  age: number | null
  zoneId: string | null
  /** Keyed by question key. */
  answers: Record<string, AnswerValue>
  existingConnectionMemberId: string | null
}

/** A CCF, with what the engine needs from its CCG. */
export interface EngineUnit {
  id: string
  code: string
  name: string
  ccgId: string
  ccgCode: string
  ccgName: string
  /** Effective zone: the CCF's own, else its CCG's. */
  zoneId: string | null
  zoneLabel: string | null
  meetingDay: string | null
  meetingTime: string | null
  capacity: number
  status: string
  ccgStatus: string
  audience: 'adult' | 'youth'
}

export type ChoiceAggregate = { kind: 'choice'; n: number; shares: Record<string, number> }
export type ScaleAggregate = { kind: 'scale'; n: number; mean: number | null }
export type QuestionAggregate = ChoiceAggregate | ScaleAggregate

export type CapacityStatus = 'below_minimum' | 'healthy' | 'near_capacity' | 'full'
export type RelationshipHealth = 'critical' | 'needs_attention' | 'healthy'

/** Aggregates over one set of members (a CCF, or a whole CCG). */
export interface MemberAggregate {
  memberCount: number
  memberIds: string[]
  /** Per member: "questionKey:optionKey" for every non-catch-all choice held. */
  memberTags: string[][]
  ages: number[]
  genderMix: { male: number; female: number; unknown: number }
  questions: Record<string, QuestionAggregate>
}

export interface CcfProfile {
  unit: EngineUnit
  own: MemberAggregate
  /** The CCF's CCG as a whole (includes this CCF). */
  ccg: MemberAggregate
  /** Question aggregates after blending with the CCG (see config.smoothing). */
  blended: Record<string, QuestionAggregate>
  /** Ages used for age fit: the CCF's, or the CCG's when the CCF has none. */
  ageSource: 'ccf' | 'ccg' | 'none'
  medianAge: number | null
  minAge: number | null
  maxAge: number | null
  /** Active members + active placements. */
  occupied: number
  /** Open proposals awaiting approval. */
  reserved: number
  availableSpaces: number
  meetingSlotKey: string | null
  meetingSlotLabel: string | null
  capacityStatus: CapacityStatus
  health: RelationshipHealth
  /** Mean of `social` distance questions' blended means. */
  socialMean: number | null
}

export interface FactorResult {
  factor: Factor
  /** 0–100, or null when there is no data and the factor is left out. */
  score: number | null
  weight: number
}

export type IneligibleReason = 'full' | 'reserved' | 'inactive' | 'minor_adult_group' | 'adult_youth_group'

export interface ScoredUnit {
  ccfId: string
  ccfCode: string
  ccfName: string
  ccgId: string
  ccgCode: string
  ccgName: string
  overall: number
  factors: FactorResult[]
  reasons: string[]
  cautions: string[]
  eligible: boolean
  ineligibleReasons: IneligibleReason[]
  availableSpaces: number
  capacity: number
  memberCount: number
}

export interface RankResult {
  ranked: ScoredUnit[]
  eligible: ScoredUnit[]
  ineligible: ScoredUnit[]
  top: ScoredUnit[]
  warnings: string[]
}
