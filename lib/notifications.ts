/**
 * Notification System for FLCSeek
 * Handles birthdays, inactive converts, milestone achievements, etc.
 */

import { query } from './neon';

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
    await query(
      `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.userId || null,
        params.type,
        params.title,
        params.message || null,
        params.entityType || null,
        params.entityId || null,
      ]
    );
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to create notification:', error);
  }
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(userId: string): Promise<any[]> {
  try {
    const result = await query(
      `SELECT * FROM notifications 
       WHERE (user_id = $1 OR user_id IS NULL) AND is_read = FALSE
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
    return result.rows;
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
    await query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = NOW()
       WHERE id = ANY($1)`,
      [notificationIds]
    );
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to mark as read:', error);
  }
}

/**
 * Get converts with birthdays this week
 * Note: date_of_birth is stored as DD-MM format
 */
export async function getBirthdaysThisWeek(): Promise<any[]> {
  try {
    const result = await query(
      `SELECT 
        nc.id,
        nc.first_name,
        nc.last_name,
        nc.date_of_birth,
        nc.phone_number,
        g.name as group_name,
        g.year as group_year
      FROM new_converts nc
      LEFT JOIN groups g ON nc.group_id = g.id
      WHERE nc.deleted_at IS NULL
        AND nc.date_of_birth IS NOT NULL
        AND EXTRACT(WEEK FROM TO_DATE(nc.date_of_birth || '-2000', 'DD-MM-YYYY')) = EXTRACT(WEEK FROM CURRENT_DATE)`,
      []
    );
    return result.rows;
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to fetch birthdays:', error);
    return [];
  }
}

/**
 * Get converts who haven't attended in X weeks
 */
export async function getInactiveConverts(weeksInactive: number = 4): Promise<any[]> {
  try {
    const result = await query(
      `SELECT 
        nc.id,
        nc.first_name,
        nc.last_name,
        nc.phone_number,
        g.name as group_name,
        g.year as group_year,
        MAX(ar.attendance_date) as last_attendance,
        CURRENT_DATE - MAX(ar.attendance_date) as days_since_attendance
      FROM new_converts nc
      LEFT JOIN groups g ON nc.group_id = g.id
      LEFT JOIN attendance_records ar ON nc.id = ar.person_id
      WHERE nc.deleted_at IS NULL
        AND g.archived = FALSE
      GROUP BY nc.id, nc.first_name, nc.last_name, nc.phone_number, g.name, g.year
      HAVING MAX(ar.attendance_date) IS NULL 
        OR MAX(ar.attendance_date) < CURRENT_DATE - INTERVAL '${weeksInactive} weeks'
      ORDER BY last_attendance ASC NULLS FIRST`,
      []
    );
    return result.rows;
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to fetch inactive converts:', error);
    return [];
  }
}

/**
 * Get recent milestone achievements (last 7 days)
 */
export async function getRecentMilestoneAchievements(): Promise<any[]> {
  try {
    const result = await query(
      `SELECT 
        pr.id,
        pr.stage_number,
        pr.stage_name,
        pr.date_completed,
        nc.id as convert_id,
        nc.first_name,
        nc.last_name,
        g.name as group_name,
        g.year as group_year
      FROM progress_records pr
      JOIN new_converts nc ON pr.person_id = nc.id
      LEFT JOIN groups g ON nc.group_id = g.id
      WHERE pr.is_completed = TRUE
        AND pr.date_completed >= CURRENT_DATE - INTERVAL '7 days'
        AND nc.deleted_at IS NULL
      ORDER BY pr.date_completed DESC
      LIMIT 100`,
      []
    );
    return result.rows;
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
    
    const result = await query(
      `SELECT 
        nc.id,
        nc.first_name,
        nc.last_name,
        nc.group_id,
        g.leader_id
      FROM new_converts nc
      LEFT JOIN groups g ON nc.group_id = g.id
      WHERE nc.deleted_at IS NULL
        AND nc.date_of_birth = $1`,
      [dayMonth]
    );
    
    let notificationCount = 0;
    
    for (const convert of result.rows) {
      // Notify the group leader
      if (convert.leader_id) {
        await createNotification({
          userId: convert.leader_id,
          type: 'BIRTHDAY',
          title: `🎂 Birthday Today!`,
          message: `${convert.first_name} ${convert.last_name} has their birthday today. Consider sending them a message!`,
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
    const [unread, birthdays, inactive, achievements] = await Promise.all([
      query(
        `SELECT COUNT(*) as count FROM notifications 
         WHERE (user_id = $1 OR user_id IS NULL) AND is_read = FALSE`,
        [userId]
      ),
      query(
        `SELECT COUNT(*) as count FROM new_converts 
         WHERE deleted_at IS NULL 
           AND date_of_birth IS NOT NULL
           AND EXTRACT(WEEK FROM TO_DATE(date_of_birth || '-2000', 'DD-MM-YYYY')) = EXTRACT(WEEK FROM CURRENT_DATE)`,
        []
      ),
      query(
        `SELECT COUNT(*) as count FROM new_converts nc
         LEFT JOIN groups g ON nc.group_id = g.id
         LEFT JOIN attendance_records ar ON nc.id = ar.person_id
         WHERE nc.deleted_at IS NULL AND g.archived = FALSE
         GROUP BY nc.id
         HAVING MAX(ar.attendance_date) IS NULL 
           OR MAX(ar.attendance_date) < CURRENT_DATE - INTERVAL '4 weeks'`,
        []
      ),
      query(
        `SELECT COUNT(*) as count FROM progress_records 
         WHERE is_completed = TRUE 
           AND date_completed >= CURRENT_DATE - INTERVAL '7 days'`,
        []
      ),
    ]);
    
    return {
      unreadCount: parseInt(unread.rows[0]?.count || '0'),
      birthdaysThisWeek: parseInt(birthdays.rows[0]?.count || '0'),
      inactiveConverts: inactive.rows.length,
      recentAchievements: parseInt(achievements.rows[0]?.count || '0'),
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
