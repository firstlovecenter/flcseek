/**
 * Leader Notification Service
 * Handles notifications to leaders for milestone completions and other events
 */

import { prisma } from './prisma'
import { logger } from './logger'

export enum NotificationType {
  MILESTONE_COMPLETED = 'milestone_completed',
  ATTENDANCE_MILESTONE = 'attendance_milestone',
  CONVERT_AT_RISK = 'convert_at_risk',
  MILESTONE_REMINDER = 'milestone_reminder',
  BULK_ACTION = 'bulk_action',
}

export interface NotificationPayload {
  convertId?: string
  convertName?: string
  groupId?: string
  groupName?: string
  milestoneStage?: number
  milestoneName?: string
  message: string
  metadata?: Record<string, any>
}

/**
 * Send notification to group leader(s)
 */
export async function notifyLeaders(
  groupId: string,
  type: NotificationType,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    // Get group and its leaders
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        leader: true,
        users: {
          where: {
            isPrimary: true,
          },
          include: {
            user: true,
          },
        },
      },
    })

    if (!group) {
      logger.warn(`Group not found: ${groupId}`)
      return false
    }

    const leaderIds: string[] = []
    if (group.leader) {
      leaderIds.push(group.leader.id)
    }

    // Also notify primary group admins
    group.users.forEach((ug) => {
      if (ug.user && !leaderIds.includes(ug.user.id)) {
        leaderIds.push(ug.user.id)
      }
    })

    if (leaderIds.length === 0) {
      logger.warn(`No leaders found for group: ${groupId}`)
      return false
    }

    // Create notifications for each leader
    const notifications = await Promise.all(
      leaderIds.map((leaderId) =>
        prisma.notification.create({
          data: {
            userId: leaderId,
            type: type,
            title: generateNotificationTitle(type, payload),
            message: payload.message,
            entityType: payload.groupId ? 'group' : undefined,
            entityId: payload.groupId,
          },
        })
      )
    )

    logger.info(
      `Sent ${notifications.length} notifications to leaders of group ${groupId}: ${type}`
    )
    return true
  } catch (error) {
    logger.error(`Error notifying leaders for group ${groupId}:`, error)
    return false
  }
}

/**
 * Generate notification title based on type and payload
 */
function generateNotificationTitle(type: NotificationType, payload: NotificationPayload): string {
  switch (type) {
    case NotificationType.MILESTONE_COMPLETED:
      return `${payload.convertName} completed milestone ${payload.milestoneName}`

    case NotificationType.ATTENDANCE_MILESTONE:
      return `${payload.convertName} reached ${payload.metadata?.attendanceCount || 0} weeks of attendance`

    case NotificationType.CONVERT_AT_RISK:
      return `⚠️ ${payload.convertName} is at risk`

    case NotificationType.MILESTONE_REMINDER:
      return `Reminder: Milestones need review in ${payload.groupName}`

    case NotificationType.BULK_ACTION:
      return `${payload.metadata?.actionType || 'Bulk action'} completed: ${payload.metadata?.count || 0} converts`

    default:
      return payload.message
  }
}

/**
 * Notify leader about milestone completion
 */
export async function notifyMilestoneCompletion(
  convertId: string,
  milestoneStageName: string,
  groupId: string
): Promise<boolean> {
  try {
    const convert = await prisma.newConvert.findUnique({
      where: { id: convertId },
    })

    if (!convert) {
      return false
    }

    const convertName = `${convert.firstName || ''} ${convert.lastName || ''}`.trim()

    return await notifyLeaders(groupId, NotificationType.MILESTONE_COMPLETED, {
      convertId,
      convertName,
      groupId,
      milestoneName: milestoneStageName,
      message: `${convertName} has automatically completed milestone: ${milestoneStageName}`,
      metadata: {
        completedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error(`Error notifying milestone completion for convert ${convertId}:`, error)
    return false
  }
}

/**
 * Bulk notify leaders about multiple milestone completions
 */
export async function notifyBulkMilestoneCompletions(
  conversions: Array<{
    convertId: string
    milestoneName: string
    groupId: string
  }>,
  userId: string
): Promise<void> {
  try {
    // Group by group ID
    const groupedByGroup = conversions.reduce(
      (acc, conv) => {
        if (!acc[conv.groupId]) {
          acc[conv.groupId] = []
        }
        acc[conv.groupId].push(conv)
        return acc
      },
      {} as Record<string, typeof conversions>
    )

    // Send notifications for each group
    for (const [groupId, milestones] of Object.entries(groupedByGroup)) {
      await notifyLeaders(groupId, NotificationType.MILESTONE_REMINDER, {
        groupId,
        message: `${milestones.length} converters auto-completed milestones today`,
        metadata: {
          count: milestones.length,
          milestones: milestones.map((m) => m.milestoneName),
          processedAt: new Date().toISOString(),
        },
      })
    }

    logger.info(`Sent bulk milestone completion notifications for ${conversions.length} converts`)
  } catch (error) {
    logger.error('Error in bulk notification:', error)
  }
}

/**
 * Send notification to convert about their milestone completion
 */
export async function notifyConvertMilestoneCompletion(
  convertId: string,
  milestoneName: string,
  groupId: string
): Promise<boolean> {
  try {
    const convert = await prisma.newConvert.findUnique({
      where: { id: convertId },
    })

    if (!convert) {
      return false
    }

    // In the future, this could send an SMS or in-app notification to the convert
    logger.info(
      `Would notify convert ${convertId} about completing milestone: ${milestoneName}`
    )
    return true
  } catch (error) {
    logger.error(`Error notifying convert about milestone:`, error)
    return false
  }
}

/**
 * Clear old notifications (older than 30 days)
 */
export async function clearOldNotifications(daysOld: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    })

    logger.info(`Cleared ${result.count} old notifications`)
    return result.count
  } catch (error) {
    logger.error('Error clearing old notifications:', error)
    return 0
  }
}
