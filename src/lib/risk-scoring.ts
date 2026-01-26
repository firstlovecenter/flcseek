/**
 * Risk Scoring Engine
 * Calculates risk scores for converts based on attendance, milestone progress, and engagement
 */

import { prisma } from './prisma'
import { logger } from './logger'
import dayjs from 'dayjs'

export interface RiskFactors {
  attendanceScore: number // 0-100 (lower is better)
  milestoneScore: number // 0-100 (lower is better)
  engagementScore: number // 0-100 (lower is better)
  timeScore: number // 0-100 (lower is better)
}

export interface RiskAssessment {
  convertId: string
  overallScore: number // 0-100
  level: 'low' | 'medium' | 'high' | 'critical'
  factors: RiskFactors
  recommendations: string[]
  calculatedAt: Date
}

/**
 * Calculate comprehensive risk score for a convert
 */
export async function calculateConvertRiskScore(convertId: string): Promise<RiskAssessment | null> {
  try {
    const convert = await prisma.newConvert.findUnique({
      where: { id: convertId },
      include: {
        attendanceRecords: true,
        progressRecords: true,
        group: true,
      },
    })

    if (!convert) {
      logger.warn(`Convert not found for risk assessment: ${convertId}`)
      return null
    }

    const factors = await calculateRiskFactors(convert)
    const overallScore = calculateOverallScore(factors)
    const level = determineRiskLevel(overallScore)
    const recommendations = generateRecommendations(convert, factors, level)

    const assessment: RiskAssessment = {
      convertId,
      overallScore,
      level,
      factors,
      recommendations,
      calculatedAt: new Date(),
    }

    // Update convert's risk score in database
    await prisma.newConvert.update({
      where: { id: convertId },
      data: { riskScore: overallScore },
    })

    return assessment
  } catch (error) {
    logger.error(`Error calculating risk score for convert ${convertId}:`, error)
    return null
  }
}

/**
 * Calculate individual risk factors
 */
async function calculateRiskFactors(convert: any): Promise<RiskFactors> {
  const today = dayjs()

  // 1. ATTENDANCE SCORE (0-100, lower is better)
  let attendanceScore = 100
  if (convert.attendanceRecords && convert.attendanceRecords.length > 0) {
    // Calculate recent attendance (last 8 weeks)
    const recentRecords = convert.attendanceRecords.filter((ar) =>
      dayjs(ar.attendanceDate).isAfter(today.subtract(8, 'weeks'))
    )

    if (recentRecords.length > 0) {
      const weeksElapsed = today.diff(
        dayjs(convert.attendanceRecords[0].attendanceDate),
        'weeks'
      )
      const attendanceRate = Math.min(recentRecords.length / Math.max(weeksElapsed, 1), 1)

      // Perfect attendance = 0 risk, no attendance = 100 risk
      attendanceScore = Math.max(0, (1 - attendanceRate) * 100)
    }
  }

  // 2. MILESTONE SCORE (0-100, lower is better)
  let milestoneScore = 100
  if (convert.progressRecords && convert.progressRecords.length > 0) {
    const completedMilestones = convert.progressRecords.filter((p) => p.isCompleted).length
    const daysRegistered = today.diff(dayjs(convert.createdAt), 'days')

    // Expected 1 milestone per month (roughly)
    const expectedMilestones = Math.ceil(daysRegistered / 30)
    const milestoneProgress = Math.min(completedMilestones / Math.max(expectedMilestones, 1), 1)

    // If progress matches or exceeds expected = 0 risk, no progress = 100 risk
    milestoneScore = Math.max(0, (1 - milestoneProgress) * 100)

    // Penalize if stalled for > 30 days
    if (convert.lastMilestoneDate) {
      const daysSinceLastMilestone = today.diff(dayjs(convert.lastMilestoneDate), 'days')
      if (daysSinceLastMilestone > 30) {
        milestoneScore = Math.min(100, milestoneScore + (daysSinceLastMilestone - 30) * 2)
      }
    }
  }

  // 3. ENGAGEMENT SCORE (0-100, lower is better)
  let engagementScore = 100
  const daysRegistered = today.diff(dayjs(convert.createdAt), 'days')

  if (daysRegistered > 0) {
    // Engagement = attendance records / days registered
    const engagementRate = Math.min(convert.attendanceRecords.length / daysRegistered, 1)
    engagementScore = Math.max(0, (1 - engagementRate) * 100)

    // If no activity in last 14 days = high risk
    if (convert.lastAttendanceDate) {
      const daysSinceAttendance = today.diff(dayjs(convert.lastAttendanceDate), 'days')
      if (daysSinceAttendance > 14) {
        engagementScore = Math.min(100, engagementScore + (daysSinceAttendance - 14) * 3)
      }
    } else if (daysRegistered > 7) {
      // Never attended = maximum risk
      engagementScore = 100
    }
  }

  // 4. TIME SCORE (0-100, lower is better)
  // Newer converts get more time before being flagged as at-risk
  let timeScore = 0
  if (daysRegistered < 7) {
    // First week: no risk
    timeScore = 0
  } else if (daysRegistered < 30) {
    // First month: low escalation
    timeScore = Math.min(20, daysRegistered - 7)
  } else if (daysRegistered < 90) {
    // 1-3 months: moderate escalation
    timeScore = 20 + Math.min(40, (daysRegistered - 30) / 2)
  } else {
    // 3+ months: full escalation
    timeScore = Math.min(100, 60 + (daysRegistered - 90) / 10)
  }

  return {
    attendanceScore: Math.round(attendanceScore),
    milestoneScore: Math.round(milestoneScore),
    engagementScore: Math.round(engagementScore),
    timeScore: Math.round(timeScore),
  }
}

/**
 * Calculate weighted overall risk score
 */
function calculateOverallScore(factors: RiskFactors): number {
  // Weights: what matters most?
  const weights = {
    attendance: 0.35, // Attendance is most important
    milestone: 0.30,
    engagement: 0.25,
    time: 0.10, // Time is a modifier
  }

  const weighted =
    factors.attendanceScore * weights.attendance +
    factors.milestoneScore * weights.milestone +
    factors.engagementScore * weights.engagement +
    factors.timeScore * weights.time

  return Math.round(weighted)
}

/**
 * Determine risk level based on score
 */
function determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score < 25) return 'low'
  if (score < 50) return 'medium'
  if (score < 75) return 'high'
  return 'critical'
}

/**
 * Generate recommendations based on risk factors
 */
function generateRecommendations(
  convert: any,
  factors: RiskFactors,
  level: string
): string[] {
  const recommendations: string[] = []

  if (factors.attendanceScore > 60) {
    recommendations.push('Convert has poor attendance. Schedule a check-in call.')
  }

  if (factors.milestoneScore > 60) {
    recommendations.push('Convert is behind on milestones. Provide additional support or resources.')
  }

  if (factors.engagementScore > 60) {
    recommendations.push('Convert shows low engagement. Consider pairing with a mentor.')
  }

  if (level === 'critical' || level === 'high') {
    recommendations.push('Schedule urgent follow-up conversation.')
    if (!convert.lastAttendanceDate) {
      recommendations.push('Convert has never attended. Reach out immediately.')
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue regular follow-up and support.')
  }

  return recommendations
}

/**
 * Batch calculate risk scores for all converts
 */
export async function calculateAllConvertRiskScores(): Promise<void> {
  try {
    logger.info('Starting batch risk score calculation...')

    const converts = await prisma.newConvert.findMany({
      where: { deletedAt: null },
      select: { id: true },
    })

    let processed = 0
    let successful = 0

    for (const convert of converts) {
      try {
        await calculateConvertRiskScore(convert.id)
        successful++
      } catch (error) {
        logger.error(`Error calculating risk for convert ${convert.id}:`, error)
      }
      processed++

      // Log progress every 100 converts
      if (processed % 100 === 0) {
        logger.info(`Risk calculation progress: ${processed}/${converts.length}`)
      }
    }

    logger.info(`Risk calculation complete: ${successful}/${processed} successful`)
  } catch (error) {
    logger.error('Error in batch risk calculation:', error)
  }
}

/**
 * Get converts by risk level
 */
export async function getConvertsByRiskLevel(
  level: 'low' | 'medium' | 'high' | 'critical',
  groupId?: string
): Promise<
  Array<{
    id: string
    firstName?: string
    lastName?: string
    riskScore: number
  }>
> {
  try {
    const scoreRanges = {
      low: { gte: 0, lt: 25 },
      medium: { gte: 25, lt: 50 },
      high: { gte: 50, lt: 75 },
      critical: { gte: 75, lte: 100 },
    }

    const range = scoreRanges[level]

    return await prisma.newConvert.findMany({
      where: {
        deletedAt: null,
        riskScore: range,
        ...(groupId && { groupId }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        riskScore: true,
      },
      orderBy: { riskScore: 'desc' },
    })
  } catch (error) {
    logger.error(`Error fetching converts by risk level ${level}:`, error)
    return []
  }
}
