/**
 * Notification System for FLCSeek
 * Handles birthdays, inactive converts, milestone achievements, etc.
 */

import { prisma } from './prisma';

// Notification types
export type NotificationType =
  | 'BIRTHDAY'
  | 'INACTIVE_CONVERT'
  | 'MILESTONE_ACHIEVEMENT'
  | 'GROUP_ACHIEVEMENT'
  | 'NEW_CONVERT'
  | 'ATTENDANCE_REMINDER';

interface CreateNotificationParams {
  userId?: string; // Null for system-wide notifications
  type: NotificationType;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Create a notification
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId || null,
        type: params.type,
        title: params.title,
        message: params.message || null,
        entityType: params.entityType || null,
        entityId: params.entityId || null,
      }
    });
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to create notification:', error);
  }
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(userId: string): Promise<unknown[]> {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId },
          { userId: null }
        ],
        isRead: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    
    return notifications.map(n => ({
      id: n.id,
      user_id: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      entity_type: n.entityType,
      entity_id: n.entityId,
      is_read: n.isRead,
      read_at: n.readAt,
      created_at: n.createdAt,
    }));
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to fetch notifications:', error);
    return [];
  }
}

/**
 * Mark notifications as read
 */
export async function markNotificationsRead(notificationIds: string[]): Promise<void> {
  try {
    await prisma.notification.updateMany({
      where: { id: { in: notificationIds } },
      data: {
        isRead: true,
        readAt: new Date(),
      }
    });
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to mark as read:', error);
  }
}

/**
 * Get converts with birthdays this week
 * Note: date_of_birth is stored as DD-MM format
 */
export async function getBirthdaysThisWeek(): Promise<unknown[]> {
  try {
    // Get current week's day-month range
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    // Get all converts with birthdays
    const converts = await prisma.newConvert.findMany({
      where: {
        dateOfBirth: { not: null },
      },
      include: {
        group: { select: { name: true, year: true } }
      }
    });
    
    // Filter by week (DD-MM format comparison)
    const weekDays: string[] = [];
    for (let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate() + 1)) {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      weekDays.push(`${day}-${month}`);
    }
    
    const birthdaysThisWeek = converts.filter(c => {
      if (!c.dateOfBirth) return false;
      const dob = new Date(c.dateOfBirth);
      const day = dob.getDate().toString().padStart(2, '0');
      const month = (dob.getMonth() + 1).toString().padStart(2, '0');
      return weekDays.includes(`${day}-${month}`);
    });
    
    return birthdaysThisWeek.map(nc => ({
      id: nc.id,
      first_name: nc.firstName,
      last_name: nc.lastName,
      date_of_birth: nc.dateOfBirth,
      phone_number: nc.phoneNumber,
      group_name: nc.group?.name || null,
      group_year: nc.group?.year || null,
    }));
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to fetch birthdays:', error);
    return [];
  }
}

/**
 * Get converts who haven't attended in X weeks
 */
export async function getInactiveConverts(weeksInactive: number = 4): Promise<unknown[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - weeksInactive * 7);
    
    const converts = await prisma.newConvert.findMany({
      where: {
        group: { archived: false }
      },
      include: {
        group: { select: { name: true, year: true } },
        attendanceRecords: {
          orderBy: { attendanceDate: 'desc' },
          take: 1,
        }
      }
    });
    
    const inactive = converts.filter(c => {
      const lastAttendance = c.attendanceRecords[0]?.attendanceDate;
      if (!lastAttendance) return true; // Never attended
      return new Date(lastAttendance) < cutoffDate;
    });
    
    // Sort by last attendance (null first)
    inactive.sort((a, b) => {
      const aDate = a.attendanceRecords[0]?.attendanceDate;
      const bDate = b.attendanceRecords[0]?.attendanceDate;
      if (!aDate && !bDate) return 0;
      if (!aDate) return -1;
      if (!bDate) return 1;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });
    
    return inactive.map(nc => {
      const lastAttendance = nc.attendanceRecords[0]?.attendanceDate;
      const daysSince = lastAttendance 
        ? Math.floor((Date.now() - new Date(lastAttendance).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      return {
        id: nc.id,
        first_name: nc.firstName,
        last_name: nc.lastName,
        phone_number: nc.phoneNumber,
        group_name: nc.group?.name || null,
        group_year: nc.group?.year || null,
        last_attendance: lastAttendance || null,
        days_since_attendance: daysSince,
      };
    });
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to fetch inactive converts:', error);
    return [];
  }
}

/**
 * Get recent milestone achievements (last 7 days)
 */
export async function getRecentMilestoneAchievements(): Promise<unknown[]> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const achievements = await prisma.progressRecord.findMany({
      where: {
        isCompleted: true,
        dateCompleted: { gte: sevenDaysAgo },
      },
      include: {
        person: {
          include: {
            group: { select: { name: true, year: true } }
          }
        }
      },
      orderBy: { dateCompleted: 'desc' },
      take: 100,
    });
    
    return achievements.map(pr => ({
      id: pr.id,
      stage_number: pr.stageNumber,
      stage_name: pr.stageName,
      date_completed: pr.dateCompleted,
      convert_id: pr.person.id,
      first_name: pr.person.firstName,
      last_name: pr.person.lastName,
      group_name: pr.person.group?.name || null,
      group_year: pr.person.group?.year || null,
    }));
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to fetch milestone achievements:', error);
    return [];
  }
}

/**
 * Generate birthday notifications for the day
 */
export async function generateBirthdayNotifications(): Promise<number> {
  try {
    // Get today's birthdays
    const today = new Date();
    const dayMonth = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const converts = await prisma.newConvert.findMany({
      where: {
        dateOfBirth: dayMonth,
      },
      include: {
        group: {
          select: { leaderId: true }
        }
      }
    });
    
    let notificationCount = 0;
    
    for (const convert of converts) {
      // Notify the group leader
      if (convert.group?.leaderId) {
        await createNotification({
          userId: convert.group.leaderId,
          type: 'BIRTHDAY',
          title: `🎂 Birthday Today!`,
          message: `${convert.firstName} ${convert.lastName} has their birthday today. Consider sending them a message!`,
          entityType: 'new_convert',
          entityId: convert.id,
        });
        notificationCount++;
      }
    }
    
    return notificationCount;
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to generate birthday notifications:', error);
    return 0;
  }
}

/**
 * Get notification summary for dashboard
 */
export async function getNotificationSummary(userId: string): Promise<{
  unreadCount: number;
  birthdaysThisWeek: number;
  inactiveConverts: number;
  recentAchievements: number;
}> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    // Get current week's day-month range
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const weekDays: string[] = [];
    for (let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate() + 1)) {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      weekDays.push(`${day}-${month}`);
    }
    
    const [unreadCount, allConvertsWithBirthdays, inactiveList, achievementsCount] = await Promise.all([
      prisma.notification.count({
        where: {
          OR: [{ userId }, { userId: null }],
          isRead: false,
        }
      }),
      prisma.newConvert.findMany({
        where: { dateOfBirth: { not: null } },
        select: { dateOfBirth: true }
      }),
      prisma.newConvert.findMany({
        where: {
          group: { archived: false }
        },
        include: {
          attendanceRecords: {
            orderBy: { attendanceDate: 'desc' },
            take: 1,
          }
        }
      }),
      prisma.progressRecord.count({
        where: {
          isCompleted: true,
          dateCompleted: { gte: sevenDaysAgo },
        }
      })
    ]);
    
    const birthdaysThisWeek = allConvertsWithBirthdays.filter(c => {
      if (!c.dateOfBirth) return false;
      const dob = new Date(c.dateOfBirth);
      const day = dob.getDate().toString().padStart(2, '0');
      const month = (dob.getMonth() + 1).toString().padStart(2, '0');
      return weekDays.includes(`${day}-${month}`);
    }).length;
    
    const inactiveConverts = inactiveList.filter(c => {
      const lastAttendance = c.attendanceRecords[0]?.attendanceDate;
      if (!lastAttendance) return true;
      return new Date(lastAttendance) < fourWeeksAgo;
    }).length;
    
    return {
      unreadCount,
      birthdaysThisWeek,
      inactiveConverts,
      recentAchievements: achievementsCount,
    };
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to fetch summary:', error);
    return {
      unreadCount: 0,
      birthdaysThisWeek: 0,
      inactiveConverts: 0,
      recentAchievements: 0,
    };
  }
}
