/**
 * Progress Records Database Queries
 * All database operations for the progress_records table
 */

import { query, queryOne, queryAll, transaction } from '../index';

// Type definitions
export interface ProgressRecord {
  id: string;
  person_id: string;
  stage_number: number;
  stage_name: string;
  is_completed: boolean;
  date_completed?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateProgressInput {
  stage_number: number;
  is_completed: boolean;
}

/**
 * Get all progress records for a person
 */
export async function findByPersonId(personId: string): Promise<ProgressRecord[]> {
  return queryAll<ProgressRecord>(`
    SELECT * FROM progress_records
    WHERE person_id = $1
    ORDER BY stage_number ASC
  `, [personId]);
}

/**
 * Get a specific progress record
 */
export async function findOne(personId: string, stageNumber: number): Promise<ProgressRecord | null> {
  return queryOne<ProgressRecord>(`
    SELECT * FROM progress_records
    WHERE person_id = $1 AND stage_number = $2
  `, [personId, stageNumber]);
}

/**
 * Update or create a progress record (upsert)
 */
export async function upsert(
  personId: string, 
  input: UpdateProgressInput,
  updatedBy?: string
): Promise<ProgressRecord> {
  const result = await queryOne<ProgressRecord>(`
    INSERT INTO progress_records (person_id, stage_number, is_completed, date_completed, updated_by)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (person_id, stage_number) 
    DO UPDATE SET 
      is_completed = EXCLUDED.is_completed,
      date_completed = CASE 
        WHEN EXCLUDED.is_completed AND progress_records.date_completed IS NULL THEN NOW()
        WHEN NOT EXCLUDED.is_completed THEN NULL
        ELSE progress_records.date_completed
      END,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING *
  `, [
    personId,
    input.stage_number,
    input.is_completed,
    input.is_completed ? new Date().toISOString() : null,
    updatedBy || null,
  ]);
  
  if (!result) {
    throw new Error('Failed to update progress');
  }
  
  return result;
}

/**
 * Toggle a milestone status
 */
export async function toggle(
  personId: string, 
  stageNumber: number,
  updatedBy?: string
): Promise<ProgressRecord> {
  const existing = await findOne(personId, stageNumber);
  const newStatus = !existing?.is_completed;
  
  return upsert(personId, {
    stage_number: stageNumber,
    is_completed: newStatus,
  }, updatedBy);
}

/**
 * Bulk update progress for a person
 */
export async function bulkUpdate(
  personId: string,
  updates: UpdateProgressInput[],
  updatedBy?: string
): Promise<ProgressRecord[]> {
  const results: ProgressRecord[] = [];
  
  await transaction(async (client) => {
    for (const update of updates) {
      const { rows } = await client.query<ProgressRecord>(`
        INSERT INTO progress_records (person_id, stage_number, is_completed, date_completed, updated_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (person_id, stage_number) 
        DO UPDATE SET 
          is_completed = EXCLUDED.is_completed,
          date_completed = CASE 
            WHEN EXCLUDED.is_completed AND progress_records.date_completed IS NULL THEN NOW()
            WHEN NOT EXCLUDED.is_completed THEN NULL
            ELSE progress_records.date_completed
          END,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *
      `, [
        personId,
        update.stage_number,
        update.is_completed,
        update.is_completed ? new Date().toISOString() : null,
        updatedBy || null,
      ]);
      
      if (rows.length > 0) {
        results.push(rows[0]);
      }
    }
  });
  
  return results;
}

/**
 * Initialize progress for a new person (create records for all milestones)
 */
export async function initializeForPerson(
  personId: string,
  milestones: { stage_number: number; stage_name: string }[]
): Promise<ProgressRecord[]> {
  const results: ProgressRecord[] = [];
  
  await transaction(async (client) => {
    for (const milestone of milestones) {
      const { rows } = await client.query<ProgressRecord>(`
        INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed)
        VALUES ($1, $2, $3, false)
        ON CONFLICT (person_id, stage_number) DO NOTHING
        RETURNING *
      `, [personId, milestone.stage_number, milestone.stage_name]);
      
      if (rows.length > 0) {
        results.push(rows[0]);
      }
    }
  });
  
  return results;
}

/**
 * Get completion stats for a group
 */
export async function getGroupStats(groupId: string): Promise<{
  total_people: number;
  milestone_stats: { stage_number: number; completed_count: number; percentage: number }[];
}> {
  // Get total people in group
  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM new_converts WHERE group_id = $1',
    [groupId]
  );
  const totalPeople = parseInt(countResult?.count || '0');
  
  // Get milestone completion counts
  const stats = await queryAll<{ stage_number: number; completed_count: string }>(`
    SELECT 
      pr.stage_number,
      COUNT(CASE WHEN pr.is_completed THEN 1 END) as completed_count
    FROM new_converts nc
    JOIN progress_records pr ON nc.id = pr.person_id
    WHERE nc.group_id = $1
    GROUP BY pr.stage_number
    ORDER BY pr.stage_number
  `, [groupId]);
  
  return {
    total_people: totalPeople,
    milestone_stats: stats.map(s => ({
      stage_number: s.stage_number,
      completed_count: parseInt(s.completed_count),
      percentage: totalPeople > 0 
        ? Math.round((parseInt(s.completed_count) / totalPeople) * 100)
        : 0,
    })),
  };
}

/**
 * Get overall completion rate for a person
 */
export async function getPersonCompletionRate(personId: string): Promise<{
  completed: number;
  total: number;
  percentage: number;
}> {
  const result = await queryOne<{ completed: string; total: string }>(`
    SELECT 
      COUNT(CASE WHEN is_completed THEN 1 END) as completed,
      COUNT(*) as total
    FROM progress_records
    WHERE person_id = $1
  `, [personId]);
  
  const completed = parseInt(result?.completed || '0');
  const total = parseInt(result?.total || '0');
  
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
