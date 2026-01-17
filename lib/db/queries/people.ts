/**
 * People (Converts) Database Queries
 * All database operations for the new_converts table
 */

import { query, queryOne, queryAll, transaction } from '../index';
import { ATTENDANCE_GOAL } from '@/lib/constants';

// Type definitions
export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  phone_number: string;
  gender?: string;
  address?: string;
  group_id?: string;
  group_name?: string;
  group_year?: number;
  registered_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PersonWithProgress extends Person {
  progress: Array<{
    stage_number: number;
    stage_name: string;
    is_completed: boolean;
    date_completed?: string;
  }>;
  completed_stages: number;
  attendance_count: number;
  progress_percentage?: number;
  attendance_percentage?: number;
}

export interface PersonWithStats extends Person {
  completed_stages: number;
  attendance_count: number;
  progress_percentage: number;
  attendance_percentage: number;
}

export interface CreatePersonInput {
  first_name: string;
  last_name: string;
  phone_number: string;
  gender?: string;
  address?: string;
  group_id?: string;
  group_name?: string;
  registered_by?: string;
}

export interface PersonFilters {
  groupId?: string;
  groupName?: string;
  month?: string;  // Filter by group name (month name like "January")
  year?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get all people with optional filters
 */
export async function findMany(filters: PersonFilters = {}): Promise<Person[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (filters.groupId) {
    conditions.push(`nc.group_id = $${paramIndex++}`);
    params.push(filters.groupId);
  }
  
  if (filters.groupName) {
    conditions.push(`g.name = $${paramIndex++}`);
    params.push(filters.groupName);
  }
  
  // Month filter is an alias for groupName (groups are named after months)
  if (filters.month) {
    conditions.push(`LOWER(g.name) = LOWER($${paramIndex++})`);
    params.push(filters.month);
  }
  
  if (filters.year) {
    conditions.push(`g.year = $${paramIndex++}`);
    params.push(filters.year);
  }
  
  if (filters.search) {
    conditions.push(`(
      LOWER(nc.first_name) LIKE LOWER($${paramIndex}) OR 
      LOWER(nc.last_name) LIKE LOWER($${paramIndex}) OR
      nc.phone_number LIKE $${paramIndex}
    )`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = filters.limit ? `LIMIT $${paramIndex++}` : '';
  const offsetClause = filters.offset ? `OFFSET $${paramIndex}` : '';
  
  if (filters.limit) params.push(filters.limit);
  if (filters.offset) params.push(filters.offset);
  
  const sql = `
    SELECT 
      nc.id,
      nc.first_name,
      nc.last_name,
      CONCAT(nc.first_name, ' ', nc.last_name) as full_name,
      nc.phone_number,
      nc.gender,
      nc.address,
      nc.group_id,
      nc.group_name,
      nc.registered_by,
      nc.created_at,
      nc.updated_at,
      g.name as group_name_ref,
      g.year as group_year
    FROM new_converts nc
    LEFT JOIN groups g ON nc.group_id = g.id
    ${whereClause}
    ORDER BY nc.first_name ASC, nc.last_name ASC
    ${limitClause}
    ${offsetClause}
  `;
  
  return queryAll<Person>(sql, params);
}

/**
 * Get a single person by ID
 */
export async function findById(id: string): Promise<Person | null> {
  return queryOne<Person>(`
    SELECT 
      nc.*,
      CONCAT(nc.first_name, ' ', nc.last_name) as full_name,
      g.name as group_name_ref,
      g.year as group_year
    FROM new_converts nc
    LEFT JOIN groups g ON nc.group_id = g.id
    WHERE nc.id = $1
  `, [id]);
}

/**
 * Get people with full progress data (optimized single query)
 */
export async function findManyWithProgress(
  filters: PersonFilters = {},
  totalMilestones: number = 18
): Promise<PersonWithProgress[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (filters.groupId) {
    conditions.push(`nc.group_id = $${paramIndex++}`);
    params.push(filters.groupId);
  }
  
  if (filters.groupName) {
    conditions.push(`g.name = $${paramIndex++}`);
    params.push(filters.groupName);
  }
  
  // Month filter is an alias for groupName (groups are named after months)
  if (filters.month) {
    conditions.push(`LOWER(g.name) = LOWER($${paramIndex++})`);
    params.push(filters.month);
  }
  
  if (filters.year) {
    conditions.push(`g.year = $${paramIndex++}`);
    params.push(filters.year);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const sql = `
    SELECT 
      nc.id,
      nc.first_name,
      nc.last_name,
      CONCAT(nc.first_name, ' ', nc.last_name) as full_name,
      nc.phone_number,
      nc.gender,
      nc.address,
      nc.group_id,
      COALESCE(g.name, nc.group_name) as group_name,
      g.year as group_year,
      nc.registered_by,
      nc.created_at,
      nc.updated_at,
      -- Aggregate progress records as JSON
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'stage_number', pr.stage_number,
            'stage_name', pr.stage_name,
            'is_completed', pr.is_completed,
            'date_completed', pr.date_completed
          ) ORDER BY pr.stage_number
        ) FILTER (WHERE pr.stage_number IS NOT NULL),
        '[]'::json
      ) as progress,
      -- Count completed stages
      COUNT(CASE WHEN pr.is_completed = true THEN 1 END) as completed_stages,
      -- Get attendance count
      (SELECT COUNT(*) FROM attendance_records a WHERE a.person_id = nc.id) as attendance_count
    FROM new_converts nc
    LEFT JOIN groups g ON nc.group_id = g.id
    LEFT JOIN progress_records pr ON nc.id = pr.person_id
    ${whereClause}
    GROUP BY nc.id, g.name, g.year
    ORDER BY nc.first_name ASC, nc.last_name ASC
  `;
  
  const rows = await queryAll<PersonWithProgress>(sql, params);
  
  // Calculate percentages
  return rows.map(person => ({
    ...person,
    completed_stages: Number(person.completed_stages) || 0,
    attendance_count: Number(person.attendance_count) || 0,
    progress_percentage: Math.round((Number(person.completed_stages) / totalMilestones) * 100),
    attendance_percentage: Math.min(
      Math.round((Number(person.attendance_count) / ATTENDANCE_GOAL) * 100),
      100
    ),
  }));
}

/**
 * Get people with stats (aggregated, lighter query)
 */
export async function findManyWithStats(
  filters: PersonFilters = {},
  totalMilestones: number = 18
): Promise<{ people: PersonWithStats[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (filters.groupId) {
    conditions.push(`nc.group_id = $${paramIndex++}`);
    params.push(filters.groupId);
  }
  
  if (filters.groupName) {
    conditions.push(`g.name = $${paramIndex++}`);
    params.push(filters.groupName);
  }
  
  if (filters.year) {
    conditions.push(`g.year = $${paramIndex++}`);
    params.push(filters.year);
  }
  
  if (filters.search) {
    conditions.push(`(
      LOWER(nc.first_name) LIKE LOWER($${paramIndex}) OR 
      LOWER(nc.last_name) LIKE LOWER($${paramIndex}) OR
      nc.phone_number LIKE $${paramIndex}
    )`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Get total count
  const countSql = `
    SELECT COUNT(DISTINCT nc.id) as total
    FROM new_converts nc
    LEFT JOIN groups g ON nc.group_id = g.id
    ${whereClause}
  `;
  const countResult = await queryOne<{ total: string }>(countSql, params);
  const total = parseInt(countResult?.total || '0');
  
  // Add pagination params
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  params.push(limit);
  params.push(offset);
  
  const sql = `
    SELECT 
      nc.id,
      nc.first_name,
      nc.last_name,
      CONCAT(nc.first_name, ' ', nc.last_name) as full_name,
      nc.phone_number,
      nc.gender,
      nc.group_id,
      COALESCE(g.name, nc.group_name) as group_name,
      g.year as group_year,
      nc.created_at,
      -- Aggregate stats
      COUNT(CASE WHEN pr.is_completed = true THEN 1 END) as completed_stages,
      (SELECT COUNT(*) FROM attendance_records a WHERE a.person_id = nc.id) as attendance_count
    FROM new_converts nc
    LEFT JOIN groups g ON nc.group_id = g.id
    LEFT JOIN progress_records pr ON nc.id = pr.person_id
    ${whereClause}
    GROUP BY nc.id, g.name, g.year
    ORDER BY nc.first_name ASC, nc.last_name ASC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;
  
  const rows = await queryAll<PersonWithStats>(sql, params);
  
  const people = rows.map(person => ({
    ...person,
    completed_stages: Number(person.completed_stages) || 0,
    attendance_count: Number(person.attendance_count) || 0,
    progress_percentage: Math.round((Number(person.completed_stages) / totalMilestones) * 100),
    attendance_percentage: Math.min(
      Math.round((Number(person.attendance_count) / ATTENDANCE_GOAL) * 100),
      100
    ),
  }));
  
  return { people, total };
}

/**
 * Create a new person
 */
export async function create(input: CreatePersonInput): Promise<Person> {
  const result = await queryOne<Person>(`
    INSERT INTO new_converts (
      first_name, last_name, phone_number, gender, address, 
      group_id, group_name, registered_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *,
      CONCAT(first_name, ' ', last_name) as full_name
  `, [
    input.first_name,
    input.last_name,
    input.phone_number,
    input.gender || null,
    input.address || null,
    input.group_id || null,
    input.group_name || null,
    input.registered_by || null,
  ]);
  
  if (!result) {
    throw new Error('Failed to create person');
  }
  
  return result;
}

/**
 * Update a person
 */
export async function update(
  id: string, 
  updates: Partial<CreatePersonInput>
): Promise<Person | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (updates.first_name !== undefined) {
    fields.push(`first_name = $${paramIndex++}`);
    params.push(updates.first_name);
  }
  if (updates.last_name !== undefined) {
    fields.push(`last_name = $${paramIndex++}`);
    params.push(updates.last_name);
  }
  if (updates.phone_number !== undefined) {
    fields.push(`phone_number = $${paramIndex++}`);
    params.push(updates.phone_number);
  }
  if (updates.gender !== undefined) {
    fields.push(`gender = $${paramIndex++}`);
    params.push(updates.gender);
  }
  if (updates.address !== undefined) {
    fields.push(`address = $${paramIndex++}`);
    params.push(updates.address);
  }
  if (updates.group_id !== undefined) {
    fields.push(`group_id = $${paramIndex++}`);
    params.push(updates.group_id);
  }
  if (updates.group_name !== undefined) {
    fields.push(`group_name = $${paramIndex++}`);
    params.push(updates.group_name);
  }
  
  if (fields.length === 0) {
    return findById(id);
  }
  
  fields.push(`updated_at = NOW()`);
  params.push(id);
  
  return queryOne<Person>(`
    UPDATE new_converts 
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *,
      CONCAT(first_name, ' ', last_name) as full_name
  `, params);
}

/**
 * Delete a person
 */
export async function remove(id: string): Promise<boolean> {
  // Use transaction to delete related records first
  return transaction(async (client) => {
    await client.query('DELETE FROM progress_records WHERE person_id = $1', [id]);
    await client.query('DELETE FROM attendance_records WHERE person_id = $1', [id]);
    const { rowCount } = await client.query('DELETE FROM new_converts WHERE id = $1', [id]);
    return rowCount > 0;
  });
}

/**
 * Bulk create people
 */
export async function createMany(
  people: CreatePersonInput[],
  options: { skipDuplicates?: boolean } = {}
): Promise<{ created: Person[]; skipped: number }> {
  const created: Person[] = [];
  let skipped = 0;
  
  await transaction(async (client) => {
    for (const input of people) {
      try {
        const { rows } = await client.query<Person>(`
          INSERT INTO new_converts (
            first_name, last_name, phone_number, gender, address, 
            group_id, group_name, registered_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (phone_number) DO ${options.skipDuplicates ? 'NOTHING' : 'UPDATE SET updated_at = NOW()'}
          RETURNING *,
            CONCAT(first_name, ' ', last_name) as full_name
        `, [
          input.first_name,
          input.last_name,
          input.phone_number,
          input.gender || null,
          input.address || null,
          input.group_id || null,
          input.group_name || null,
          input.registered_by || null,
        ]);
        
        if (rows.length > 0) {
          created.push(rows[0]);
        } else {
          skipped++;
        }
      } catch (err) {
        if (options.skipDuplicates) {
          skipped++;
        } else {
          throw err;
        }
      }
    }
  });
  
  return { created, skipped };
}

/**
 * Count people with filters
 */
export async function count(filters: PersonFilters = {}): Promise<number> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (filters.groupId) {
    conditions.push(`nc.group_id = $${paramIndex++}`);
    params.push(filters.groupId);
  }
  
  if (filters.groupName) {
    conditions.push(`g.name = $${paramIndex++}`);
    params.push(filters.groupName);
  }
  
  if (filters.year) {
    conditions.push(`g.year = $${paramIndex++}`);
    params.push(filters.year);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const result = await queryOne<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM new_converts nc
    LEFT JOIN groups g ON nc.group_id = g.id
    ${whereClause}
  `, params);
  
  return parseInt(result?.count || '0');
}
