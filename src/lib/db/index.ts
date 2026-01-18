/**
 * Database Connection - Central Export
 * Import from '@/lib/db' for database access
 * 
 * Now uses Prisma ORM instead of raw Neon queries
 */

import { prisma } from '@/lib/prisma';

// Re-export prisma client for direct use
export { prisma };

/**
 * Transaction helper - wraps Prisma's transaction API
 */
export async function transaction<T>(
  callback: (tx: typeof prisma) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    return callback(tx as unknown as typeof prisma);
  });
}

/**
 * Helper for safe field mapping (snake_case to camelCase responses)
 * Use when you need to return snake_case format for API compatibility
 */
export function toSnakeCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

/**
 * Helper to convert array of objects to snake_case
 */
export function toSnakeCaseArray<T extends Record<string, unknown>>(arr: T[]): Record<string, unknown>[] {
  return arr.map(toSnakeCase);
}

// ============================================
// Legacy exports for backwards compatibility
// These allow gradual migration of existing code
// ============================================

/**
 * @deprecated Use prisma directly or import from query modules
 * Legacy query function - wraps Prisma's $queryRaw for raw SQL if needed
 */
export async function query<T = unknown>(
  _text: string, 
  _params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  console.warn('query() is deprecated. Use Prisma client directly.');
  throw new Error('Raw SQL queries are no longer supported. Please use Prisma client methods.');
}

/**
 * @deprecated Use prisma directly
 */
export async function queryOne<T = unknown>(
  _text: string, 
  _params?: unknown[]
): Promise<T | null> {
  console.warn('queryOne() is deprecated. Use Prisma client directly.');
  throw new Error('Raw SQL queries are no longer supported. Please use Prisma client methods.');
}

/**
 * @deprecated Use prisma directly
 */
export async function queryAll<T = unknown>(
  _text: string, 
  _params?: unknown[]
): Promise<T[]> {
  console.warn('queryAll() is deprecated. Use Prisma client directly.');
  throw new Error('Raw SQL queries are no longer supported. Please use Prisma client methods.');
}
