/**
 * Groups Database Queries
 * All database operations for the groups table
 */

import { query, queryOne, queryAll, transaction } from '../index';

// Type definitions
export interface Group {
  id: string;
  name: string;
  year: number;
  leader_id?: string;
  leader_name?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface CreateGroupInput {
  name: string;
  year: number;
  leader_id?: string;
  description?: string;
}

export interface GroupFilters {
  year?: number;
  isActive?: boolean;
  leaderId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get all groups with optional filters
 */
export async function findMany(filters: GroupFilters = {}): Promise<Group[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (filters.year) {
    conditions.push(`g.year = $${paramIndex++}`);
    params.push(filters.year);
  }
  
  if (filters.isActive !== undefined) {
    conditions.push(`g.is_active = $${paramIndex++}`);
    params.push(filters.isActive);
  }
  
  if (filters.leaderId) {
    conditions.push(`g.leader_id = $${paramIndex++}`);
    params.push(filters.leaderId);
  }
  
  if (filters.search) {
    conditions.push(`LOWER(g.name) LIKE LOWER($${paramIndex++})`);
    params.push(`%${filters.search}%`);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = filters.limit ? `LIMIT $${paramIndex++}` : '';
  const offsetClause = filters.offset ? `OFFSET $${paramIndex}` : '';
  
  if (filters.limit) params.push(filters.limit);
  if (filters.offset) params.push(filters.offset);
  
  const sql = `
    SELECT 
      g.id,
      g.name,
      g.year,
      g.leader_id,
      g.description,
      g.is_active,
      g.created_at,
      g.updated_at,
      u.username as leader_name,
      CONCAT(u.first_name, ' ', u.last_name) as leader_full_name,
      COUNT(nc.id) as member_count
    FROM groups g
    LEFT JOIN users u ON g.leader_id = u.id
    LEFT JOIN new_converts nc ON nc.group_id = g.id
    ${whereClause}
    GROUP BY g.id, u.username, u.first_name, u.last_name
    ORDER BY g.year DESC, g.name ASC
    ${limitClause}
    ${offsetClause}
  `;
  
  const rows = await queryAll<Group>(sql, params);
  return rows.map(g => ({ ...g, member_count: Number(g.member_count) || 0 }));
}

/**
 * Get a single group by ID
 */
export async function findById(id: string): Promise<Group | null> {
  return queryOne<Group>(`
    SELECT 
      g.*,
      u.username as leader_name,
      CONCAT(u.first_name, ' ', u.last_name) as leader_full_name,
      COUNT(nc.id) as member_count
    FROM groups g
    LEFT JOIN users u ON g.leader_id = u.id
    LEFT JOIN new_converts nc ON nc.group_id = g.id
    WHERE g.id = $1
    GROUP BY g.id, u.username, u.first_name, u.last_name
  `, [id]);
}

/**
 * Find group by name and year
 */
export async function findByNameAndYear(name: string, year: number): Promise<Group | null> {
  return queryOne<Group>(`
    SELECT g.*, COUNT(nc.id) as member_count
    FROM groups g
    LEFT JOIN new_converts nc ON nc.group_id = g.id
    WHERE g.name = $1 AND g.year = $2
    GROUP BY g.id
  `, [name, year]);
}

/**
 * Create a new group
 */
export async function create(input: CreateGroupInput): Promise<Group> {
  const result = await queryOne<Group>(`
    INSERT INTO groups (name, year, leader_id, description, is_active)
    VALUES ($1, $2, $3, $4, true)
    RETURNING *
  `, [
    input.name,
    input.year,
    input.leader_id || null,
    input.description || null,
  ]);
  
  if (!result) {
    throw new Error('Failed to create group');
  }
  
  return { ...result, member_count: 0 };
}

/**
 * Update a group
 */
export async function update(
  id: string, 
  updates: Partial<CreateGroupInput & { is_active?: boolean }>
): Promise<Group | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    params.push(updates.name);
  }
  if (updates.year !== undefined) {
    fields.push(`year = $${paramIndex++}`);
    params.push(updates.year);
  }
  if (updates.leader_id !== undefined) {
    fields.push(`leader_id = $${paramIndex++}`);
    params.push(updates.leader_id);
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
  
  return queryOne<Group>(`
    UPDATE groups 
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `, params);
}

/**
 * Delete a group
 */
export async function remove(id: string): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM groups WHERE id = $1', [id]);
  return rowCount > 0;
}

/**
 * Clone groups from previous year
 */
export async function cloneFromPreviousYear(
  sourceYear: number,
  targetYear: number
): Promise<{ cloned: Group[]; errors: string[] }> {
  const cloned: Group[] = [];
  const errors: string[] = [];
  
  // Get groups from source year
  const sourceGroups = await findMany({ year: sourceYear, isActive: true });
  
  await transaction(async (client) => {
    for (const group of sourceGroups) {
      try {
        // Check if group already exists for target year
        const existing = await findByNameAndYear(group.name, targetYear);
        if (existing) {
          errors.push(`Group "${group.name}" already exists for ${targetYear}`);
          continue;
        }
        
        const { rows } = await client.query<Group>(`
          INSERT INTO groups (name, year, description, is_active)
          VALUES ($1, $2, $3, true)
          RETURNING *
        `, [group.name, targetYear, group.description]);
        
        if (rows.length > 0) {
          cloned.push({ ...rows[0], member_count: 0 });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Failed to clone "${group.name}": ${message}`);
      }
    }
  });
  
  return { cloned, errors };
}

/**
 * Get available years
 */
export async function getAvailableYears(): Promise<number[]> {
  const rows = await queryAll<{ year: number }>(
    'SELECT DISTINCT year FROM groups ORDER BY year DESC'
  );
  return rows.map(r => r.year);
}

/**
 * Count groups with filters
 */
export async function count(filters: GroupFilters = {}): Promise<number> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (filters.year) {
    conditions.push(`year = $${paramIndex++}`);
    params.push(filters.year);
  }
  
  if (filters.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    params.push(filters.isActive);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const result = await queryOne<{ count: string }>(`
    SELECT COUNT(*) as count FROM groups ${whereClause}
  `, params);
  
  return parseInt(result?.count || '0');
}
