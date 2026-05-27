/**
 * Alert Management Service
 * Manages alert rules and convert alerts
 */

import { prisma } from './prisma'
import { logger } from './logger'
import { calculateConvertRiskScore } from './risk-scoring'
import { notifyLeaders, NotificationType } from './leader-notifications'
import dayjs from 'dayjs'

/** Minimal convert shape needed by the alert evaluation engine */
interface ConvertForAlert {
  id?: string
  createdAt?: Date | null
  lastAttendanceDate?: Date | string | null
  lastMilestoneDate?: Date | string | null
  riskScore?: number | null
}

/** Minimal alert rule shape */
interface AlertRuleForEval {
  id?: string
  type: string
  criteria: {
    threshold?: number
    [key: string]: unknown
  }
}

export type AlertStatus = 'active' | 'acknowledged' | 'resolved'
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Evaluate all alert rules for a convert and create alerts if triggered
 */
export async function evaluateAlertsForConvert(convertId: string): Promise<string[]> {
  try {
    const convert = await prisma.newConvert.findUnique({
      where: { id: convertId },
      include: { group: true },
    })

    if (!convert || !convert.groupId) {
      return []
    }

    // Get all active alert rules
    const alertRules = await prisma.alertRule.findMany({
      where: { isActive: true },
    })

    const triggeredAlerts: string[] = []

    for (const rule of alertRules) {
      const shouldTrigger = await evaluateAlertRule(convert, rule as AlertRuleForEval)

      if (shouldTrigger) {
        // Check if alert already exists and is active
        const existingAlert = await prisma.convertAlert.findFirst({
          where: {
            convertId,
            alertRuleId: rule.id,
            status: 'active',
          },
        })

        if (!existingAlert) {
          // Create new alert
          const severity = determineSeverity(rule.type, convert.riskScore || 0)

          const alert = await prisma.convertAlert.create({
            data: {
              convertId,
              alertRuleId: rule.id,
              severity,
              status: 'active',
            },
          })

          triggeredAlerts.push(alert.id)

          // Notify leaders
          await notifyLeaders(convert.groupId, NotificationType.HIGH_RISK, {
            convertId,
            convertName: `${convert.firstName || ''} ${convert.lastName || ''}`.trim(),
            groupId: convert.groupId,
            message: `Alert: ${rule.name} triggered for ${convert.firstName} ${convert.lastName}`,
            metadata: {
              alertType: rule.type,
              severity,
            },
          })

          logger.info(
            `Alert triggered: Convert ${convertId}, Rule ${rule.type}, Severity ${severity}`
          )
        }
      }
    }

    return triggeredAlerts
  } catch (error) {
    logger.error(`Error evaluating alerts for convert ${convertId}:`, error)
    return []
  }
}

/**
 * Evaluate if an alert rule should trigger for a convert
 */
async function evaluateAlertRule(convert: ConvertForAlert, rule: AlertRuleForEval): Promise<boolean> {
  try {
    const criteria = rule.criteria

    switch (rule.type) {
      case 'attendance_drop': {
        // Check if attendance rate has dropped below threshold
        if (convert.lastAttendanceDate) {
          const daysSinceAttendance = dayjs().diff(dayjs(convert.lastAttendanceDate), 'days')
          return daysSinceAttendance > (criteria.threshold || 7)
        }
        return false
      }

      case 'milestone_stall': {
        // Check if no milestones completed in specified period
        if (convert.lastMilestoneDate) {
          const daysSinceLastMilestone = dayjs().diff(dayjs(convert.lastMilestoneDate), 'days')
          return daysSinceLastMilestone > (criteria.threshold || 30)
        }
        // If never completed a milestone and over threshold days
        const daysSinceRegistered = dayjs().diff(dayjs(convert.createdAt), 'days')
        return daysSinceRegistered > (criteria.threshold || 30)
      }

      case 'missing': {
        // Check for extended absence
        if (convert.lastAttendanceDate) {
          const daysSinceAttendance = dayjs().diff(dayjs(convert.lastAttendanceDate), 'days')
          return daysSinceAttendance > (criteria.threshold || 14)
        }
        return false
      }

      case 'high_risk': {
        // Check if risk score exceeds threshold
        const riskScore = convert.riskScore || 0
        return riskScore > (criteria.threshold || 70)
      }

      default:
        return false
    }
  } catch (error) {
    logger.error(`Error evaluating alert rule ${rule.type}:`, error)
    return false
  }
}

/**
 * Determine alert severity based on alert type and convert data
 */
function determineSeverity(
  alertType: string,
  riskScore: number
): AlertSeverity {
  if (riskScore >= 80) return 'critical'
  if (riskScore >= 60) return 'high'
  if (riskScore >= 40) return 'medium'
  return 'low'
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: string,
  reason?: string
): Promise<boolean> {
  try {
    await prisma.convertAlert.update({
      where: { id: alertId },
      data: {
        status: 'acknowledged',
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    })

    logger.info(`Alert ${alertId} acknowledged by user ${userId}`)
    return true
  } catch (error) {
    logger.error(`Error acknowledging alert ${alertId}:`, error)
    return false
  }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(
  alertId: string,
  userId: string,
  reason?: string
): Promise<boolean> {
  try {
    await prisma.convertAlert.update({
      where: { id: alertId },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
      },
    })

    logger.info(`Alert ${alertId} resolved by user ${userId}`)
    return true
  } catch (error) {
    logger.error(`Error resolving alert ${alertId}:`, error)
    return false
  }
}

/**
 * Get active alerts for a group
 */
export async function getGroupAlerts(
  groupId: string,
  status?: AlertStatus
): Promise<any[]> {
  try {
    return await prisma.convertAlert.findMany({
      where: {
        convert: { groupId },
        ...(status && { status }),
      },
      include: {
        convert: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            riskScore: true,
          },
        },
        alertRule: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    })
  } catch (error) {
    logger.error(`Error fetching alerts for group ${groupId}:`, error)
    return []
  }
}

/**
 * Get alerts for a convert
 */
export async function getConvertAlerts(
  convertId: string,
  status?: AlertStatus
): Promise<any[]> {
  try {
    return await prisma.convertAlert.findMany({
      where: {
        convertId,
        ...(status && { status }),
      },
      include: {
        alertRule: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    })
  } catch (error) {
    logger.error(`Error fetching alerts for convert ${convertId}:`, error)
    return []
  }
}

/**
 * Create or update an alert rule
 */
export async function upsertAlertRule(rule: {
  id?: string
  name: string
  type: string
  criteria: Record<string, any>
  notificationChannels?: string[]
  isActive?: boolean
}): Promise<any> {
  try {
    if (rule.id) {
      return await prisma.alertRule.update({
        where: { id: rule.id },
        data: {
          name: rule.name,
          criteria: rule.criteria,
          notificationChannels: rule.notificationChannels,
          isActive: rule.isActive !== false,
        },
      })
    } else {
      return await prisma.alertRule.create({
        data: {
          name: rule.name,
          type: rule.type,
          criteria: rule.criteria,
          notificationChannels: rule.notificationChannels,
          isActive: rule.isActive !== false,
        },
      })
    }
  } catch (error) {
    logger.error(`Error upserting alert rule:`, error)
    throw error
  }
}

/**
 * Batch evaluate alerts for all active converts
 */
export async function evaluateAllConvertAlerts(): Promise<void> {
  try {
    logger.info('Starting batch alert evaluation...')

    // First, recalculate all risk scores
    const converts = await prisma.newConvert.findMany({
      where: { deletedAt: null },
      select: { id: true },
    })

    let alertCount = 0

    for (const convert of converts) {
      await calculateConvertRiskScore(convert.id)
      const alerts = await evaluateAlertsForConvert(convert.id)
      alertCount += alerts.length
    }

    logger.info(`Alert evaluation complete: ${alertCount} alerts triggered`)
  } catch (error) {
    logger.error('Error in batch alert evaluation:', error)
  }
}
