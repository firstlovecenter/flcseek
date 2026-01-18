/**
 * Audit Logging System for FLCSeek
 * Tracks all important actions for accountability and debugging
 */

import { prisma } from './prisma';

// Action types for audit logging
export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'DELETE_USER'
  | 'CREATE_CONVERT'
  | 'UPDATE_CONVERT'
  | 'DELETE_CONVERT'
  | 'CREATE_GROUP'
  | 'UPDATE_GROUP'
  | 'ARCHIVE_GROUP'
  | 'CLONE_GROUP'
  | 'UPDATE_PROGRESS'
  | 'MARK_ATTENDANCE'
  | 'DELETE_ATTENDANCE'
  | 'CREATE_MILESTONE'
  | 'UPDATE_MILESTONE'
  | 'DELETE_MILESTONE'
  | 'BULK_REGISTER'
  | 'EXPORT_DATA';

// Entity types that can be logged
export type EntityType =
  | 'user'
  | 'new_convert'
  | 'group'
  | 'milestone'
  | 'progress_record'
  | 'attendance_record';

interface AuditLogEntry {
  userId?: string;
  action: AuditAction | string;
  entityType?: EntityType | string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an action to the audit trail
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: entry.userId || null,
        action: entry.action,
        entityType: entry.entityType || null,
        entityId: entry.entityId || null,
        oldValues: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        newValues: entry.newValues ? JSON.stringify(entry.newValues) : null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
      }
    });
  } catch (error) {
    // Log to console but don't throw - audit logging shouldn't break the app
    console.error('[AUDIT] Failed to log event:', error);
  }
}

/**
 * Extract IP and User Agent from Next.js request headers
 */
export function extractRequestInfo(headers: Headers): { ipAddress: string; userAgent: string } {
  const forwardedFor = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const userAgent = headers.get('user-agent') || 'unknown';
  
  let ipAddress = 'unknown';
  if (forwardedFor) {
    ipAddress = forwardedFor.split(',')[0].trim();
  } else if (realIp) {
    ipAddress = realIp;
  }
  
  return { ipAddress, userAgent };
}

/**
 * Get recent activity logs for a user or entity
 */
export async function getActivityLogs(options: {
  userId?: string;
  entityType?: EntityType | string;
  entityId?: string;
  action?: AuditAction | string;
  limit?: number;
  offset?: number;
}): Promise<unknown[]> {
  try {
    const where: Record<string, unknown> = {};
    
    if (options.userId) where.userId = options.userId;
    if (options.entityType) where.entityType = options.entityType;
    if (options.entityId) where.entityId = options.entityId;
    if (options.action) where.action = options.action;
    
    const logs = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });
    
    return logs.map(al => ({
      id: al.id,
      user_id: al.userId,
      action: al.action,
      entity_type: al.entityType,
      entity_id: al.entityId,
      old_values: al.oldValues,
      new_values: al.newValues,
      ip_address: al.ipAddress,
      user_agent: al.userAgent,
      created_at: al.createdAt,
      user_name: al.user?.username || null,
      user_full_name: al.user ? `${al.user.firstName || ''} ${al.user.lastName || ''}`.trim() : null,
    }));
  } catch (error) {
    console.error('[AUDIT] Failed to fetch activity logs:', error);
    return [];
  }
}

/**
 * Get activity summary for dashboard
 */
export async function getActivitySummary(days: number = 7): Promise<{
  totalActions: number;
  byAction: Record<string, number>;
  byUser: Array<{ userId: string; userName: string; count: number }>;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const logs = await prisma.activityLog.findMany({
      where: {
        createdAt: { gte: cutoffDate }
      },
      include: {
        user: {
          select: { username: true }
        }
      }
    });
    
    const totalActions = logs.length;
    
    // Count by action
    const byAction: Record<string, number> = {};
    for (const log of logs) {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
    }
    
    // Count by user
    const userCounts: Record<string, { userName: string; count: number }> = {};
    for (const log of logs) {
      if (log.userId) {
        if (!userCounts[log.userId]) {
          userCounts[log.userId] = {
            userName: log.user?.username || 'Unknown',
            count: 0
          };
        }
        userCounts[log.userId].count++;
      }
    }
    
    const byUser = Object.entries(userCounts)
      .map(([userId, data]) => ({
        userId,
        userName: data.userName,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return { totalActions, byAction, byUser };
  } catch (error) {
    console.error('[AUDIT] Failed to fetch activity summary:', error);
    return { totalActions: 0, byAction: {}, byUser: [] };
  }
}
