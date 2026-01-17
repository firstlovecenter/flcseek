/**
 * Users Database Queries
 * All database operations for the users table
 */

import { query, queryOne, queryAll, transaction } from '../index';
import { hashPassword } from '@/lib/auth';
import { UserRole } from '@/lib/constants';

// Type definitions
export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  group_id?: string;
  group_name?: string;
  group_year?: number;
  created_at: string;
  updated_at: string;
}

export interface UserWithPassword extends User {
  password: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  group_id?: string;
  group_name?: string;
}

export interface UserFilters {
  role?: UserRole | UserRole[];
  groupId?: string;
  search?: string;
  excludeSystemUsers?: boolean;
  limit?: number;
  offset?: number;
}

const SYSTEM_USERNAMES = ['skaduteye', 'sysadmin'];

/**
 * Get all users with optional filters
 */
export async function findMany(filters: UserFilters = {}): Promise<User[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (filters.role) {
    const roles = Array.isArray(filters.role) ? filters.role : [filters.role];
    conditions.push(`u.role = ANY($${paramIndex++})`);
    params.push(roles);
  }
  
  if (filters.groupId) {
    conditions.push(`u.group_id = $${paramIndex++}`);
    params.push(filters.groupId);
  }
  
  if (filters.excludeSystemUsers !== false) {
    conditions.push(`u.username NOT IN ('skaduteye', 'sysadmin')`);
  }
  
  if (filters.search) {
    conditions.push(`(
      LOWER(u.username) LIKE LOWER($${paramIndex}) OR
      LOWER(u.first_name) LIKE LOWER($${paramIndex}) OR
      LOWER(u.last_name) LIKE LOWER($${paramIndex}) OR
      u.phone_number LIKE $${paramIndex}
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
      u.id,
      u.username,
      u.email,
      u.role,
      u.first_name,
      u.last_name,
      u.phone_number,
      u.group_id,
      u.group_name,
      u.created_at,
      u.updated_at,
      g.year as group_year
    FROM users u
    LEFT JOIN groups g ON u.group_id = g.id
    ${whereClause}
    ORDER BY COALESCE(u.first_name, u.username) ASC
    ${limitClause}
    ${offsetClause}
  `;
  
  return queryAll<User>(sql, params);
}

/**
 * Get a single user by ID
 */
export async function findById(id: string): Promise<User | null> {
  return queryOne<User>(`
    SELECT 
      u.id,
      u.username,
      u.email,
      u.role,
      u.first_name,
      u.last_name,
      u.phone_number,
      u.group_id,
      u.group_name,
      u.created_at,
      u.updated_at,
      g.year as group_year
    FROM users u
    LEFT JOIN groups g ON u.group_id = g.id
    WHERE u.id = $1
  `, [id]);
}

/**
 * Get a user by username (for authentication)
 */
export async function findByUsername(username: string): Promise<UserWithPassword | null> {
  return queryOne<UserWithPassword>(`
    SELECT 
      u.*,
      g.year as group_year
    FROM users u
    LEFT JOIN groups g ON u.group_id = g.id
    WHERE LOWER(u.username) = LOWER($1)
  `, [username]);
}

/**
 * Get users by role (e.g., all leaders, all sheep-seekers)
 */
export async function findByRole(role: UserRole | UserRole[]): Promise<User[]> {
  return findMany({ role });
}

/**
 * Get leaders for assignment dropdown
 */
export async function findLeaders(): Promise<User[]> {
  return findMany({ role: ['leader', 'admin'] });
}

/**
 * Create a new user
 */
export async function create(input: CreateUserInput): Promise<User> {
  const hashedPassword = hashPassword(input.password);
  
  const result = await queryOne<User>(`
    INSERT INTO users (
      username, password, email, role, 
      first_name, last_name, phone_number, 
      group_id, group_name
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, username, email, role, first_name, last_name, 
              phone_number, group_id, group_name, created_at, updated_at
  `, [
    input.username,
    hashedPassword,
    input.email || null,
    input.role,
    input.first_name || null,
    input.last_name || null,
    input.phone_number || null,
    input.group_id || null,
    input.group_name || null,
  ]);
  
  if (!result) {
    throw new Error('Failed to create user');
  }
  
  return result;
}

/**
 * Update a user
 */
export async function update(
  id: string, 
  updates: Partial<Omit<CreateUserInput, 'username'> & { password?: string }>
): Promise<User | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (updates.password !== undefined) {
    fields.push(`password = $${paramIndex++}`);
    params.push(hashPassword(updates.password));
  }
  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    params.push(updates.email);
  }
  if (updates.role !== undefined) {
    fields.push(`role = $${paramIndex++}`);
    params.push(updates.role);
  }
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
  
  return queryOne<User>(`
    UPDATE users 
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, username, email, role, first_name, last_name, 
              phone_number, group_id, group_name, created_at, updated_at
  `, params);
}

/**
 * Delete a user
 */
export async function remove(id: string): Promise<boolean> {
  // Check if it's a system user
  const user = await findById(id);
  if (user && SYSTEM_USERNAMES.includes(user.username)) {
    throw new Error('Cannot delete system user');
  }
  
  const { rowCount } = await query('DELETE FROM users WHERE id = $1', [id]);
  return rowCount > 0;
}

/**
 * Check if username exists
 */
export async function usernameExists(username: string, excludeId?: string): Promise<boolean> {
  const params: unknown[] = [username];
  let sql = 'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)';
  
  if (excludeId) {
    sql += ' AND id != $2';
    params.push(excludeId);
  }
  
  const result = await queryOne(sql, params);
  return result !== null;
}

/**
 * Get user's assigned groups
 */
export async function getUserGroups(userId: string): Promise<{ group_id: string; group_name: string; year: number }[]> {
  return queryAll(`
    SELECT g.id as group_id, g.name as group_name, g.year
    FROM groups g
    WHERE g.leader_id = $1
    ORDER BY g.year DESC, g.name ASC
  `, [userId]);
}

/**
 * Assign user to group
 */
export async function assignToGroup(userId: string, groupId: string): Promise<void> {
  await transaction(async (client) => {
    // Update user's primary group
    await client.query(
      'UPDATE users SET group_id = $1, updated_at = NOW() WHERE id = $2',
      [groupId, userId]
    );
    
    // Also set user as group leader
    await client.query(
      'UPDATE groups SET leader_id = $1, updated_at = NOW() WHERE id = $2',
      [userId, groupId]
    );
  });
}

/**
 * Count users with filters
 */
export async function count(filters: UserFilters = {}): Promise<number> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (filters.role) {
    const roles = Array.isArray(filters.role) ? filters.role : [filters.role];
    conditions.push(`role = ANY($${paramIndex++})`);
    params.push(roles);
  }
  
  if (filters.excludeSystemUsers !== false) {
    conditions.push(`username NOT IN ('skaduteye', 'sysadmin')`);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const result = await queryOne<{ count: string }>(`
    SELECT COUNT(*) as count FROM users ${whereClause}
  `, params);
  
  return parseInt(result?.count || '0');
}
