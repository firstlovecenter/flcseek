/**
 * Prisma Database Connection - Central Export
 * Import from '@/lib/db' for database access
 * 
 * This replaces the old Neon connection pool with Prisma ORM
 */

import { prisma } from '@/lib/prisma';

// Re-export prisma client for direct use
export { prisma };

/**
 * Transaction helper - matches the old API
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
