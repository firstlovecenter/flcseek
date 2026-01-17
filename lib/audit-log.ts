/**
 * Audit Logging System for FLCSeek
 * Tracks all important actions for accountability and debugging
 */

import { query } from './neon';

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
  action: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an action to the audit trail
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO activity_logs (
        user_id, action, entity_type, entity_id, 
        old_values, new_values, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.userId || null,
        entry.action,
        entry.entityType || null,
        entry.entityId || null,
        entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        entry.newValues ? JSON.stringify(entry.newValues) : null,
        entry.ipAddress || null,
        entry.userAgent || null,
      ]
    );
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
  entityType?: EntityType;
  entityId?: string;
  action?: AuditAction;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    if (options.userId) {
      conditions.push(`al.user_id = $${paramIndex}`);
      params.push(options.userId);
      paramIndex++;
    }
    
    if (options.entityType) {
      conditions.push(`al.entity_type = $${paramIndex}`);
      params.push(options.entityType);
      paramIndex++;
    }
    
    if (options.entityId) {
      conditions.push(`al.entity_id = $${paramIndex}`);
      params.push(options.entityId);
      paramIndex++;
    }
    
    if (options.action) {
      conditions.push(`al.action = $${paramIndex}`);
      params.push(options.action);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    params.push(limit, offset);
    
    const result = await query(
      `SELECT 
        al.*,
        u.username as user_name,
        CONCAT(u.first_name, ' ', u.last_name) as user_full_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );
    
    return result.rows;
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
    const result = await query(
      `WITH recent_logs AS (
        SELECT * FROM activity_logs 
        WHERE created_at > NOW() - INTERVAL '${days} days'
      )
      SELECT 
        COUNT(*) as total_actions,
        (
          SELECT json_object_agg(action, count)
          FROM (SELECT action, COUNT(*) as count FROM recent_logs GROUP BY action) a
        ) as by_action,
        (
          SELECT json_agg(json_build_object('userId', user_id, 'userName', user_name, 'count', count))
          FROM (
            SELECT r.user_id, COALESCE(u.username, 'Unknown') as user_name, COUNT(*) as count
            FROM recent_logs r
            LEFT JOIN users u ON r.user_id = u.id
            GROUP BY r.user_id, u.username
            ORDER BY count DESC
            LIMIT 10
          ) t
        ) as by_user
      FROM recent_logs`,
      []
    );
    
    const row = result.rows[0];
    return {
      totalActions: parseInt(row?.total_actions || '0'),
      byAction: row?.by_action || {},
      byUser: row?.by_user || [],
    };
  } catch (error) {
    console.error('[AUDIT] Failed to fetch activity summary:', error);
    return { totalActions: 0, byAction: {}, byUser: [] };
  }
}
