/**
 * Attendance Records Database Queries
 * All database operations for the attendance_records table
 */

import { query, queryOne, queryAll, transaction } from '../index';
import { ATTENDANCE_GOAL } from '@/lib/constants';

// Type definitions
export interface AttendanceRecord {
  id: string;
  person_id: string;
  date_attended: string;
  service_type?: string;
  notes?: string;
  recorded_by?: string;
  created_at: string;
}

export interface CreateAttendanceInput {
  person_id: string;
  date_attended: string;
  service_type?: string;
  notes?: string;
  recorded_by?: string;
}

export interface AttendanceFilters {
  personId?: string;
  groupId?: string;
  startDate?: string;
  endDate?: string;
  serviceType?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get attendance records with optional filters
 */
export async function findMany(filters: AttendanceFilters = {}): Promise<AttendanceRecord[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (filters.personId) {
    conditions.push(`a.person_id = $${paramIndex++}`);
    params.push(filters.personId);
  }
  
  if (filters.groupId) {
    conditions.push(`nc.group_id = $${paramIndex++}`);
    params.push(filters.groupId);
  }
  
  if (filters.startDate) {
    conditions.push(`a.date_attended >= $${paramIndex++}`);
    params.push(filters.startDate);
  }
  
  if (filters.endDate) {
    conditions.push(`a.date_attended <= $${paramIndex++}`);
    params.push(filters.endDate);
  }
  
  if (filters.serviceType) {
    conditions.push(`a.service_type = $${paramIndex++}`);
    params.push(filters.serviceType);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = filters.limit ? `LIMIT $${paramIndex++}` : '';
  const offsetClause = filters.offset ? `OFFSET $${paramIndex}` : '';
  
  if (filters.limit) params.push(filters.limit);
  if (filters.offset) params.push(filters.offset);
  
  const sql = `
    SELECT a.*
    FROM attendance_records a
    LEFT JOIN new_converts nc ON a.person_id = nc.id
    ${whereClause}
    ORDER BY a.date_attended DESC, a.created_at DESC
    ${limitClause}
    ${offsetClause}
  `;
  
  return queryAll<AttendanceRecord>(sql, params);
}

/**
 * Get attendance for a specific person
 */
export async function findByPersonId(personId: string): Promise<AttendanceRecord[]> {
  return findMany({ personId });
}

/**
 * Get attendance count for a person
 */
export async function getCountForPerson(personId: string): Promise<number> {
  const result = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM attendance_records WHERE person_id = $1',
    [personId]
  );
  return parseInt(result?.count || '0');
}

/**
 * Record attendance for a person
 */
export async function create(input: CreateAttendanceInput): Promise<AttendanceRecord> {
  const result = await queryOne<AttendanceRecord>(`
    INSERT INTO attendance_records (person_id, date_attended, service_type, notes, recorded_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [
    input.person_id,
    input.date_attended,
    input.service_type || null,
    input.notes || null,
    input.recorded_by || null,
  ]);
  
  if (!result) {
    throw new Error('Failed to record attendance');
  }
  
  return result;
}

/**
 * Bulk record attendance for multiple people
 */
export async function createMany(
  records: CreateAttendanceInput[]
): Promise<{ created: AttendanceRecord[]; errors: string[] }> {
  const created: AttendanceRecord[] = [];
  const errors: string[] = [];
  
  await transaction(async (client) => {
    for (const record of records) {
      try {
        // Check for duplicate (same person, same date)
        const existing = await queryOne<{ id: string }>(`
          SELECT id FROM attendance_records 
          WHERE person_id = $1 AND date_attended = $2
        `, [record.person_id, record.date_attended]);
        
        if (existing) {
          errors.push(`Attendance already recorded for ${record.person_id} on ${record.date_attended}`);
          continue;
        }
        
        const { rows } = await client.query<AttendanceRecord>(`
          INSERT INTO attendance_records (person_id, date_attended, service_type, notes, recorded_by)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [
          record.person_id,
          record.date_attended,
          record.service_type || null,
          record.notes || null,
          record.recorded_by || null,
        ]);
        
        if (rows.length > 0) {
          created.push(rows[0]);
          
          // Check if this completes the attendance milestone
          await updateAttendanceMilestone(record.person_id, client);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Failed to record for ${record.person_id}: ${message}`);
      }
    }
  });
  
  return { created, errors };
}

/**
 * Update attendance milestone (milestone 18) when threshold is reached
 */
async function updateAttendanceMilestone(
  personId: string,
  client?: { query: <R = unknown>(text: string, params?: unknown[]) => Promise<{ rows: R[]; rowCount: number }> }
): Promise<void> {
  const queryFn = client?.query.bind(client) || (async <R = unknown>(text: string, params?: unknown[]) => {
    const res = await query<R>(text, params);
    return res;
  });
  
  // Get current attendance count
  const { rows: countRows } = await queryFn<{ count: string }>(
    'SELECT COUNT(*) as count FROM attendance_records WHERE person_id = $1',
    [personId]
  );
  const attendanceCount = parseInt(countRows[0]?.count || '0');
  
  // Check if milestone 18 should be marked complete
  if (attendanceCount >= ATTENDANCE_GOAL) {
    await queryFn(`
      INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, date_completed)
      VALUES ($1, 18, 'Attendance', true, NOW())
      ON CONFLICT (person_id, stage_number) 
      DO UPDATE SET is_completed = true, date_completed = COALESCE(progress_records.date_completed, NOW())
    `, [personId]);
  }
}

/**
 * Delete an attendance record
 */
export async function remove(id: string): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM attendance_records WHERE id = $1', [id]);
  return rowCount > 0;
}

/**
 * Get attendance stats for a group
 */
export async function getGroupStats(groupId: string): Promise<{
  total_people: number;
  with_attendance: number;
  goal_reached: number;
  average_attendance: number;
}> {
  const result = await queryOne<{
    total_people: string;
    with_attendance: string;
    goal_reached: string;
    total_attendance: string;
  }>(`
    SELECT 
      COUNT(DISTINCT nc.id) as total_people,
      COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN nc.id END) as with_attendance,
      COUNT(DISTINCT CASE WHEN (
        SELECT COUNT(*) FROM attendance_records WHERE person_id = nc.id
      ) >= $1 THEN nc.id END) as goal_reached,
      COUNT(a.id) as total_attendance
    FROM new_converts nc
    LEFT JOIN attendance_records a ON nc.id = a.person_id
    WHERE nc.group_id = $2
  `, [ATTENDANCE_GOAL, groupId]);
  
  const totalPeople = parseInt(result?.total_people || '0');
  const totalAttendance = parseInt(result?.total_attendance || '0');
  
  return {
    total_people: totalPeople,
    with_attendance: parseInt(result?.with_attendance || '0'),
    goal_reached: parseInt(result?.goal_reached || '0'),
    average_attendance: totalPeople > 0 ? Math.round(totalAttendance / totalPeople) : 0,
  };
}

/**
 * Get attendance by week for analytics
 */
export async function getWeeklyStats(
  groupId?: string,
  weeks: number = 12
): Promise<{ week: string; count: number }[]> {
  const params: unknown[] = [weeks];
  const groupFilter = groupId ? 'AND nc.group_id = $2' : '';
  if (groupId) params.push(groupId);
  
  return queryAll<{ week: string; count: number }>(`
    SELECT 
      DATE_TRUNC('week', a.date_attended)::date as week,
      COUNT(*) as count
    FROM attendance_records a
    JOIN new_converts nc ON a.person_id = nc.id
    WHERE a.date_attended >= NOW() - INTERVAL '1 week' * $1
    ${groupFilter}
    GROUP BY DATE_TRUNC('week', a.date_attended)
    ORDER BY week DESC
  `, params);
}
