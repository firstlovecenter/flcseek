import { NextRequest } from 'next/server';
import {
  success,
  errors,
  requireAuth,
  getQueryParams,
  getEffectiveGroupFilter,
} from '@/lib/api';
import { query, queryOne } from '@/lib/db';
import * as Groups from '@/lib/db/queries/groups';
import * as Progress from '@/lib/db/queries/progress';
import * as Attendance from '@/lib/db/queries/attendance';
import { ROLES } from '@/lib/constants';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/stats
 * Get dashboard statistics
 * 
 * Query params:
 * - group_id: Filter by specific group
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    const params = getQueryParams(request);
    const filters = getEffectiveGroupFilter(user!, params);
    
    // Build base conditions
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (filters.groupId) {
      conditions.push(`group_id = $${paramIndex++}`);
      values.push(filters.groupId);
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
    
    // Get total people count
    const peopleCountResult = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM new_converts nc
      ${whereClause}
    `, values);
    
    // Get active groups count
    const groupsCountResult = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM groups 
      WHERE is_active = true
    `);
    
    // Get completion stats
    const completionStats = await queryOne<{
      total_people: number;
      people_with_progress: number;
      total_completed: number;
    }>(`
      SELECT 
        COUNT(DISTINCT nc.id) as total_people,
        COUNT(DISTINCT pr.convert_id) as people_with_progress,
        COUNT(CASE WHEN pr.is_completed = true THEN 1 END) as total_completed
      FROM new_converts nc
      LEFT JOIN progress_records pr ON nc.id = pr.convert_id
      ${whereClause}
    `, values);
    
    // Get active milestones count
    const milestonesCountResult = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM milestones WHERE is_active = true
    `);
    
    // Get recent attendance count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let recentAttendanceQuery = `
      SELECT COUNT(*) as count 
      FROM attendance_records ar
      JOIN new_converts nc ON ar.person_id = nc.id
      WHERE ar.date_attended >= $${paramIndex++}
    `;
    const attendanceValues = [...values, thirtyDaysAgo.toISOString()];
    
    if (conditions.length > 0) {
      recentAttendanceQuery += ` AND ${conditions.join(' AND ')}`;
    }
    
    const recentAttendanceResult = await queryOne<{ count: number }>(
      recentAttendanceQuery,
      attendanceValues
    );
    
    // Get group-wise stats (for admin view)
    let groupStats = null;
    if (user!.role === ROLES.SUPERADMIN || user!.role === ROLES.LEADPASTOR) {
      const groupStatsResult = await query<{
        group_id: string;
        group_name: string;
        member_count: number;
        completion_percentage: number;
      }>(`
        SELECT 
          g.id as group_id,
          g.name as group_name,
          COUNT(DISTINCT nc.id) as member_count,
          ROUND(
            CASE WHEN COUNT(DISTINCT nc.id) > 0 THEN
              (COUNT(CASE WHEN pr.is_completed = true THEN 1 END)::float / 
               (COUNT(DISTINCT nc.id) * $1)) * 100
            ELSE 0 END
          , 1) as completion_percentage
        FROM groups g
        LEFT JOIN new_converts nc ON g.id = nc.group_id
        LEFT JOIN progress_records pr ON nc.id = pr.convert_id
        WHERE g.is_active = true
        GROUP BY g.id, g.name
        ORDER BY g.name
      `, [milestonesCountResult?.count || 1]);
      
      groupStats = groupStatsResult;
    }
    
    // Calculate overall completion rate
    const totalPossibleCompletions = 
      (completionStats?.total_people || 0) * (milestonesCountResult?.count || 1);
    const overallCompletionRate = totalPossibleCompletions > 0
      ? Math.round((completionStats?.total_completed || 0) / totalPossibleCompletions * 100)
      : 0;
    
    return success({
      summary: {
        totalPeople: Number(peopleCountResult?.count || 0),
        totalGroups: Number(groupsCountResult?.count || 0),
        totalMilestones: Number(milestonesCountResult?.count || 0),
        recentAttendance: Number(recentAttendanceResult?.count || 0),
        completionRate: overallCompletionRate,
      },
      groupStats,
    });
  } catch (err) {
    console.error('[GET /api/v1/stats]', err);
    return errors.internal();
  }
}
