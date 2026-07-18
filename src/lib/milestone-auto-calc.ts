/**
 * Milestone Auto-Calculation Service
 * Handles automatic milestone progression based on attendance and time
 */

import { randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { logger } from './logger'
import dayjs from 'dayjs'

export interface MilestoneAutoTriggerConfig {
  enabled: boolean
  conditions: AutoTriggerCondition[]
  logic?: 'AND' | 'OR'
  notifyLeaders?: boolean
}

export interface AutoTriggerCondition {
  type: 'attendance_count' | 'time_elapsed' | 'previous_milestone' | 'custom'
  value: number | string
  operator?: 'equals' | 'gte' | 'lte'
}

export interface MilestoneProgressionResult {
  convertId: string
  completedMilestones: string[]
  newlyCompletedCount: number
  wasSuccessful: boolean
  error?: string
}

/**
 * The facts about a convert that auto-trigger conditions are evaluated against.
 * Kept as a plain value object so condition evaluation is pure and unit-testable.
 */
export interface ConvertEvaluationInput {
  attendanceCount: number
  daysSinceRegistration: number
  completedStages: Set<number>
}

function compareWithOperator(
  actual: number,
  threshold: number,
  operator: AutoTriggerCondition['operator']
): boolean {
  switch (operator || 'gte') {
    case 'equals':
      return actual === threshold
    case 'gte':
      return actual >= threshold
    case 'lte':
      return actual <= threshold
    default:
      return false
  }
}

/**
 * Evaluate a single auto-trigger condition. Pure function — no I/O.
 */
export function evaluateCondition(
  input: ConvertEvaluationInput,
  stageNumber: number,
  condition: AutoTriggerCondition
): boolean {
  switch (condition.type) {
    case 'attendance_count': {
      const threshold = typeof condition.value === 'number' ? condition.value : 0
      return compareWithOperator(input.attendanceCount, threshold, condition.operator)
    }

    case 'time_elapsed': {
      const daysThreshold = typeof condition.value === 'number' ? condition.value : 0
      return compareWithOperator(input.daysSinceRegistration, daysThreshold, condition.operator)
    }

    case 'previous_milestone': {
      const previousMilestoneNum = stageNumber - 1
      if (previousMilestoneNum < 1) return true // First milestone always passes
      return input.completedStages.has(previousMilestoneNum)
    }

    case 'custom':
      // Implement custom logic as needed
      return true

    default:
      return false
  }
}

/**
 * Evaluate a full condition set with AND/OR logic. Pure function — no I/O.
 */
export function evaluateConditionSet(
  input: ConvertEvaluationInput,
  stageNumber: number,
  conditions: AutoTriggerCondition[],
  logic: 'AND' | 'OR' = 'AND'
): boolean {
  if (!conditions || conditions.length === 0) return false
  const results = conditions.map((c) => evaluateCondition(input, stageNumber, c))
  return logic === 'AND' ? results.every(Boolean) : results.some(Boolean)
}

// ---------------------------------------------------------------------------
// System user resolution
// ---------------------------------------------------------------------------

const SYSTEM_USERNAME = 'system'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let cachedSystemUserId: string | null = null

/**
 * Resolve the user id that automated jobs write progress records under.
 * progress_records.updated_by is a UUID foreign key, so this must be a real
 * users row — never a bare string like "system".
 *
 * Order: valid SYSTEM_USER_ID env var pointing at an existing user →
 * existing "system" user → create the "system" user (non-loginable: its
 * password is random bytes, not a bcrypt hash, so verification always fails).
 */
export async function getSystemUserId(): Promise<string> {
  if (cachedSystemUserId) return cachedSystemUserId

  const fromEnv = process.env.SYSTEM_USER_ID
  if (fromEnv && UUID_RE.test(fromEnv)) {
    const exists = await prisma.user.findUnique({ where: { id: fromEnv }, select: { id: true } })
    if (exists) {
      cachedSystemUserId = exists.id
      return exists.id
    }
    logger.warn(`SYSTEM_USER_ID ${fromEnv} does not match any user — falling back to '${SYSTEM_USERNAME}' user`)
  } else if (fromEnv) {
    logger.warn(`SYSTEM_USER_ID is not a valid UUID — falling back to '${SYSTEM_USERNAME}' user`)
  }

  const existing = await prisma.user.findUnique({
    where: { username: SYSTEM_USERNAME },
    select: { id: true },
  })
  if (existing) {
    cachedSystemUserId = existing.id
    return existing.id
  }

  const created = await prisma.user.create({
    data: {
      username: SYSTEM_USERNAME,
      password: randomBytes(48).toString('hex'), // not a bcrypt hash — login impossible
      role: 'system',
      firstName: 'System',
      lastName: 'Automation',
    },
    select: { id: true },
  })
  logger.info(`Created system automation user ${created.id}`)
  cachedSystemUserId = created.id
  return created.id
}

// ---------------------------------------------------------------------------
// Per-convert evaluation (used by the on-demand /api/milestones/auto-update)
// ---------------------------------------------------------------------------

/**
 * Check if a convert meets criteria for automatic milestone completion
 */
export async function evaluateMilestoneCompletion(
  convertId: string,
  userId: string
): Promise<MilestoneProgressionResult> {
  try {
    const result: MilestoneProgressionResult = {
      convertId,
      completedMilestones: [],
      newlyCompletedCount: 0,
      wasSuccessful: true,
    }

    const convert = await prisma.newConvert.findUnique({
      where: { id: convertId },
      select: {
        id: true,
        createdAt: true,
        progressRecords: { select: { stageNumber: true, isCompleted: true } },
        _count: { select: { attendanceRecords: true } },
      },
    })

    if (!convert) {
      result.wasSuccessful = false
      result.error = 'Convert not found'
      return result
    }

    const autoTriggeredMilestones = await prisma.milestone.findMany({
      where: { isActive: true, isAutoCalculated: true },
      orderBy: { stageNumber: 'asc' },
    })

    const input: ConvertEvaluationInput = {
      attendanceCount: convert._count.attendanceRecords,
      daysSinceRegistration: dayjs().diff(dayjs(convert.createdAt), 'days'),
      completedStages: new Set(
        convert.progressRecords.filter((p) => p.isCompleted).map((p) => p.stageNumber)
      ),
    }

    for (const milestone of autoTriggeredMilestones) {
      const config = milestone.autoTriggerConfig as unknown as (MilestoneAutoTriggerConfig | null)
      if (!config?.enabled) continue

      if (input.completedStages.has(milestone.stageNumber)) {
        result.completedMilestones.push(`${milestone.stageNumber}`)
        continue
      }

      const conditionsMet = evaluateConditionSet(
        input,
        milestone.stageNumber,
        config.conditions,
        config.logic || 'AND'
      )

      if (conditionsMet) {
        await prisma.progressRecord.upsert({
          where: {
            personId_stageNumber: {
              personId: convertId,
              stageNumber: milestone.stageNumber,
            },
          },
          update: {
            isCompleted: true,
            dateCompleted: new Date(),
            updatedById: userId,
          },
          create: {
            personId: convertId,
            stageNumber: milestone.stageNumber,
            stageName: milestone.stageName || `Stage ${milestone.stageNumber}`,
            isCompleted: true,
            dateCompleted: new Date(),
            updatedById: userId,
          },
        })

        // Later milestones in this same run see this one as completed.
        input.completedStages.add(milestone.stageNumber)
        result.completedMilestones.push(`${milestone.stageNumber}`)
        result.newlyCompletedCount++

        logger.info(`Milestone auto-completed: Convert ${convertId}, Stage ${milestone.stageNumber}`)
      }
    }

    if (result.newlyCompletedCount > 0) {
      await prisma.newConvert.update({
        where: { id: convertId },
        data: { lastMilestoneDate: new Date() },
      })
    }

    return result
  } catch (error) {
    logger.error(`Error evaluating milestone completion for convert ${convertId}:`, error)
    return {
      convertId,
      completedMilestones: [],
      newlyCompletedCount: 0,
      wasSuccessful: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ---------------------------------------------------------------------------
// Daily batch job (Netlify scheduled function)
// ---------------------------------------------------------------------------

/**
 * Run milestone auto-completion for all active converts.
 *
 * Set-based: a fixed number of queries regardless of convert count, instead of
 * the previous 3+ queries per convert (which risked scheduled-function
 * timeouts as data grew).
 *  1. active auto-trigger milestones
 *  2. active converts (id, createdAt)
 *  3. attendance counts grouped by convert
 *  4. completed progress stages
 *  5. one INSERT … ON CONFLICT upsert for every newly-met milestone
 *  6. one updateMany stamping lastMilestoneDate on affected converts
 */
export async function runDailyMilestoneAutoCompletion(userId?: string): Promise<void> {
  try {
    logger.info('Starting daily milestone auto-completion process')

    const updatedById = userId && UUID_RE.test(userId) ? userId : await getSystemUserId()

    const milestones = await prisma.milestone.findMany({
      where: { isActive: true, isAutoCalculated: true },
      orderBy: { stageNumber: 'asc' },
      select: { stageNumber: true, stageName: true, autoTriggerConfig: true },
    })
    const activeMilestones = milestones
      .map((m) => ({
        stageNumber: m.stageNumber,
        stageName: m.stageName || `Stage ${m.stageNumber}`,
        config: m.autoTriggerConfig as unknown as MilestoneAutoTriggerConfig | null,
      }))
      .filter((m) => m.config?.enabled)

    if (activeMilestones.length === 0) {
      logger.info('No enabled auto-trigger milestones — nothing to do')
      return
    }

    const [converts, attendanceCounts, completedProgress] = await Promise.all([
      prisma.newConvert.findMany({
        where: { deletedAt: null },
        select: { id: true, createdAt: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ['personId'],
        _count: { personId: true },
      }),
      prisma.progressRecord.findMany({
        where: { isCompleted: true },
        select: { personId: true, stageNumber: true },
      }),
    ])

    const attendanceByPerson = new Map(
      attendanceCounts.map((a) => [a.personId, a._count.personId])
    )
    const completedByPerson = new Map<string, Set<number>>()
    for (const p of completedProgress) {
      let set = completedByPerson.get(p.personId)
      if (!set) {
        set = new Set()
        completedByPerson.set(p.personId, set)
      }
      set.add(p.stageNumber)
    }

    // Evaluate everything in memory.
    const now = dayjs()
    const toComplete: { personId: string; stageNumber: number; stageName: string }[] = []

    for (const convert of converts) {
      const input: ConvertEvaluationInput = {
        attendanceCount: attendanceByPerson.get(convert.id) ?? 0,
        daysSinceRegistration: now.diff(dayjs(convert.createdAt), 'days'),
        completedStages: completedByPerson.get(convert.id) ?? new Set(),
      }

      // Milestones are ordered; completing one lets the next see it via
      // the previous_milestone condition within the same run.
      for (const milestone of activeMilestones) {
        if (input.completedStages.has(milestone.stageNumber)) continue
        const met = evaluateConditionSet(
          input,
          milestone.stageNumber,
          milestone.config!.conditions,
          milestone.config!.logic || 'AND'
        )
        if (met) {
          input.completedStages.add(milestone.stageNumber)
          toComplete.push({
            personId: convert.id,
            stageNumber: milestone.stageNumber,
            stageName: milestone.stageName,
          })
        }
      }
    }

    if (toComplete.length === 0) {
      logger.info(
        `Daily milestone auto-completion complete: ${converts.length} converts evaluated, 0 new milestones`
      )
      return
    }

    // Single set-based upsert for all newly-met milestones.
    const personIds = toComplete.map((t) => t.personId)
    const stageNumbers = toComplete.map((t) => t.stageNumber)
    const stageNames = toComplete.map((t) => t.stageName)

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, date_completed, updated_by)
      SELECT t.person_id, t.stage_number, t.stage_name, true, CURRENT_DATE, ${updatedById}::uuid
      FROM unnest(
        ${personIds}::uuid[],
        ${stageNumbers}::int[],
        ${stageNames}::text[]
      ) AS t(person_id, stage_number, stage_name)
      ON CONFLICT (person_id, stage_number)
      DO UPDATE SET
        is_completed = true,
        date_completed = CURRENT_DATE,
        updated_by = EXCLUDED.updated_by
      WHERE progress_records.is_completed IS NOT TRUE
    `)

    const affectedConverts = Array.from(new Set(personIds))
    await prisma.newConvert.updateMany({
      where: { id: { in: affectedConverts } },
      data: { lastMilestoneDate: new Date() },
    })

    logger.info(
      `Daily milestone auto-completion complete: ${converts.length} converts evaluated, ` +
        `${toComplete.length} new milestones across ${affectedConverts.length} converts`
    )
  } catch (error) {
    logger.error('Error in daily milestone auto-completion:', error)
    throw error
  }
}

/**
 * Get auto-trigger configuration for a milestone
 */
export async function getMilestoneAutoTriggerConfig(
  milestoneId: string
): Promise<MilestoneAutoTriggerConfig | null> {
  try {
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: { autoTriggerConfig: true },
    })

    if (!milestone || !milestone.autoTriggerConfig) {
      return null
    }

    return milestone.autoTriggerConfig as unknown as MilestoneAutoTriggerConfig
  } catch (error) {
    logger.error(`Error getting auto-trigger config for milestone ${milestoneId}:`, error)
    return null
  }
}

/**
 * Update auto-trigger configuration for a milestone
 */
export async function updateMilestoneAutoTriggerConfig(
  milestoneId: string,
  config: MilestoneAutoTriggerConfig
): Promise<boolean> {
  try {
    await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        autoTriggerConfig: config as unknown as any,
      },
    })

    logger.info(`Updated auto-trigger config for milestone ${milestoneId}`)
    return true
  } catch (error) {
    logger.error(`Error updating auto-trigger config for milestone ${milestoneId}:`, error)
    return false
  }
}
