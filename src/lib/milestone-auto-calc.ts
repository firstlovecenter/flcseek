/**
 * Milestone Auto-Calculation Service
 * Handles automatic milestone progression based on attendance and time
 */

import { prisma } from './prisma'
import { logger } from './logger'
import dayjs from 'dayjs'

/** Minimal shape of a convert with relations needed by the auto-calc engine */
interface ConvertForAutoCalc {
  id?: string
  createdAt?: Date | null
  attendanceRecords: Array<{ attendanceDate: Date | string }>
  progressRecords?: Array<{ stageNumber: number; isCompleted: boolean }>
}

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

    // Get convert and their progress
    const convert = await prisma.newConvert.findUnique({
      where: { id: convertId },
      include: {
        progressRecords: {
          include: {
            person: true,
          },
        },
        attendanceRecords: true,
        group: true,
      },
    })

    if (!convert) {
      result.wasSuccessful = false
      result.error = 'Convert not found'
      return result
    }

    // Get all active milestones with auto-trigger enabled
    const autoTriggeredMilestones = await prisma.milestone.findMany({
      where: {
        isActive: true,
        isAutoCalculated: true,
      },
      orderBy: {
        stageNumber: 'asc',
      },
    })

    // Evaluate each milestone
    for (const milestone of autoTriggeredMilestones) {
      const config = milestone.autoTriggerConfig as unknown as (MilestoneAutoTriggerConfig | null)
      if (!config?.enabled) continue

      // Check if already completed
      const existingProgress = convert.progressRecords.find(
        (p) => p.stageNumber === milestone.stageNumber
      )
      if (existingProgress?.isCompleted) {
        result.completedMilestones.push(`${milestone.stageNumber}`)
        continue
      }

      // Evaluate conditions
      const conditionsMet = await evaluateConditions(
        convert as ConvertForAutoCalc,
        milestone.stageNumber,
        config.conditions,
        config.logic || 'AND'
      )

      if (conditionsMet) {
        // Mark milestone as completed
        const progressUpdate = await prisma.progressRecord.upsert({
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

        result.completedMilestones.push(`${milestone.stageNumber}`)
        result.newlyCompletedCount++

        // Update convert's last milestone date
        await prisma.newConvert.update({
          where: { id: convertId },
          data: {
            lastMilestoneDate: new Date(),
          },
        })

        logger.info(`Milestone auto-completed: Convert ${convertId}, Stage ${milestone.stageNumber}`)
      }
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

/**
 * Evaluate if conditions are met for milestone completion
 */
async function evaluateConditions(
  convert: ConvertForAutoCalc,
  stageNumber: number,
  conditions: AutoTriggerCondition[],
  logic: 'AND' | 'OR'
): Promise<boolean> {
  const results = await Promise.all(
    conditions.map((condition) => evaluateSingleCondition(convert, stageNumber, condition))
  )

  return logic === 'AND' ? results.every((r) => r) : results.some((r) => r)
}

/**
 * Evaluate a single condition
 */
async function evaluateSingleCondition(
  convert: ConvertForAutoCalc,
  stageNumber: number,
  condition: AutoTriggerCondition
): Promise<boolean> {
  try {
    switch (condition.type) {
      case 'attendance_count': {
        // Count attendance records
        const count = convert.attendanceRecords.length
        const threshold = typeof condition.value === 'number' ? condition.value : 0
        const operator = condition.operator || 'gte'

        switch (operator) {
          case 'equals':
            return count === threshold
          case 'gte':
            return count >= threshold
          case 'lte':
            return count <= threshold
          default:
            return false
        }
      }

      case 'time_elapsed': {
        // Check if enough time has passed since registration
        const daysThreshold = typeof condition.value === 'number' ? condition.value : 0
        const daysSinceRegistration = dayjs().diff(dayjs(convert.createdAt), 'days')

        const operator = condition.operator || 'gte'
        switch (operator) {
          case 'equals':
            return daysSinceRegistration === daysThreshold
          case 'gte':
            return daysSinceRegistration >= daysThreshold
          case 'lte':
            return daysSinceRegistration <= daysThreshold
          default:
            return false
        }
      }

      case 'previous_milestone': {
        // Check if previous milestone is completed
        const previousMilestoneNum = stageNumber - 1
        if (previousMilestoneNum < 1) return true // First milestone always passes

        const previousProgress = (convert.progressRecords ?? []).find(
          (p) => p.stageNumber === previousMilestoneNum
        )
        return previousProgress?.isCompleted || false
      }

      case 'custom':
        // Implement custom logic as needed
        return true

      default:
        return false
    }
  } catch (error) {
    logger.error(`Error evaluating condition:`, error)
    return false
  }
}

/**
 * Run milestone auto-completion for a group (daily cron job)
 */
export async function runDailyMilestoneAutoCompletion(userId: string): Promise<void> {
  try {
    logger.info('Starting daily milestone auto-completion process')

    // Get all active converts
    const converts = await prisma.newConvert.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
      },
    })

    let totalProcessed = 0
    let totalNewMilestones = 0

    for (const convert of converts) {
      const result = await evaluateMilestoneCompletion(convert.id, userId)
      if (result.wasSuccessful) {
        totalProcessed++
        totalNewMilestones += result.newlyCompletedCount
      }
    }

    logger.info(
      `Daily milestone auto-completion complete: ${totalProcessed} converts processed, ${totalNewMilestones} new milestones completed`
    )
  } catch (error) {
    logger.error('Error in daily milestone auto-completion:', error)
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
