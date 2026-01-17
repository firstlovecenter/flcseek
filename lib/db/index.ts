/**
 * Database Connection - Central Export
 * Import from '@/lib/db' for database access
 */

import { Pool } from '@neondatabase/serverless';

const neonConnectionString = process.env.NEON_DATABASE_URL!;

// Optimized connection pool configuration for Neon
export const pool = new Pool({
  connectionString: neonConnectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  maxUses: 7500,
});

// Performance monitoring
function measureQuery(label: string) {
  const start = Date.now();
  return () => {
    const duration = Date.now() - start;
    if (duration > 100) {
      console.warn(`[Slow Query] ${label}: ${duration}ms`);
    }
  };
}

/**
 * Execute a parameterized SQL query
 */
export async function query<T = unknown>(
  text: string, 
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const endMeasure = measureQuery(text.substring(0, 50));
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
  } finally {
    client.release();
    endMeasure();
  }
}

/**
 * Execute a query and return a single row or null
 */
export async function queryOne<T = unknown>(
  text: string, 
  params?: unknown[]
): Promise<T | null> {
  const { rows } = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Execute a query and return all rows
 */
export async function queryAll<T = unknown>(
  text: string, 
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await query<T>(text, params);
  return rows;
}

/**
 * Execute a transaction with multiple queries
 */
export async function transaction<T>(
  callback: (client: {
    query: <R = unknown>(text: string, params?: unknown[]) => Promise<{ rows: R[]; rowCount: number }>;
  }) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({
      query: async <R = unknown>(text: string, params?: unknown[]) => {
        const res = await client.query(text, params);
        return { rows: res.rows as R[], rowCount: res.rowCount ?? 0 };
      },
    });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Re-export for backwards compatibility
export { pool as sql };
