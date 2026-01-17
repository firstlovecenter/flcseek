/**
 * Milestones Database Queries
 * All database operations for the milestones table
 */

import { queryOne, queryAll } from '../index';

// Type definitions
export interface Milestone {
  id: string;
  stage_number: number;
  stage_name: string;
  short_name?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMilestoneInput {
  stage_number: number;
  stage_name: string;
  short_name?: string;
  description?: string;
  is_active?: boolean;
}

/**
 * Get all active milestones
 */
export async function findActive(): Promise<Milestone[]> {
  return queryAll<Milestone>(`
    SELECT * FROM milestones
    WHERE is_active = true
    ORDER BY stage_number ASC
  `);
}

/**
 * Get all milestones (including inactive)
 */
export async function findAll(): Promise<Milestone[]> {
  return queryAll<Milestone>(`
    SELECT * FROM milestones
    ORDER BY stage_number ASC
  `);
}

/**
 * Get milestone by stage number
 */
export async function findByStageNumber(stageNumber: number): Promise<Milestone | null> {
  return queryOne<Milestone>(`
    SELECT * FROM milestones WHERE stage_number = $1
  `, [stageNumber]);
}

/**
 * Get milestone by ID
 */
export async function findById(id: string): Promise<Milestone | null> {
  return queryOne<Milestone>(`
    SELECT * FROM milestones WHERE id = $1
  `, [id]);
}

/**
 * Create a milestone
 */
export async function create(input: CreateMilestoneInput): Promise<Milestone> {
  const result = await queryOne<Milestone>(`
    INSERT INTO milestones (stage_number, stage_name, short_name, description, is_active)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [
    input.stage_number,
    input.stage_name,
    input.short_name || null,
    input.description || null,
    input.is_active !== false,
  ]);
  
  if (!result) {
    throw new Error('Failed to create milestone');
  }
  
  return result;
}

/**
 * Update a milestone
 */
export async function update(
  id: string,
  updates: Partial<CreateMilestoneInput>
): Promise<Milestone | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (updates.stage_number !== undefined) {
    fields.push(`stage_number = $${paramIndex++}`);
    params.push(updates.stage_number);
  }
  if (updates.stage_name !== undefined) {
    fields.push(`stage_name = $${paramIndex++}`);
    params.push(updates.stage_name);
  }
  if (updates.short_name !== undefined) {
    fields.push(`short_name = $${paramIndex++}`);
    params.push(updates.short_name);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    params.push(updates.description);
  }
  if (updates.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    params.push(updates.is_active);
  }
  
  if (fields.length === 0) {
    return findById(id);
  }
  
  fields.push(`updated_at = NOW()`);
  params.push(id);
  
  return queryOne<Milestone>(`
    UPDATE milestones 
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `, params);
}

/**
 * Toggle milestone active status
 */
export async function toggleActive(id: string): Promise<Milestone | null> {
  return queryOne<Milestone>(`
    UPDATE milestones 
    SET is_active = NOT is_active, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id]);
}

/**
 * Get active milestone count
 */
export async function countActive(): Promise<number> {
  const result = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM milestones WHERE is_active = true'
  );
  return parseInt(result?.count || '0');
}
