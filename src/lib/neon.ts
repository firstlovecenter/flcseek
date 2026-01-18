import { Pool } from '@neondatabase/serverless';

const neonConnectionString = process.env.NEON_DATABASE_URL!;

// Optimized connection pool configuration for Neon
export const pool = new Pool({
  connectionString: neonConnectionString,
  max: 20,                      // Maximum pool size
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout if no connection available in 5s
  maxUses: 7500,                // Neon-recommended: connection reuse limit
});

// Performance monitoring helper
function measureQuery(label: string) {
  const start = Date.now();
  return () => {
    const duration = Date.now() - start;
    if (duration > 100) {
      console.warn(`[Slow Query] ${label}: ${duration}ms`);
    }
  };
}

export async function query(text: string, params?: any[]) {
  const endMeasure = measureQuery(text.substring(0, 50));
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
    endMeasure();
  }
}
