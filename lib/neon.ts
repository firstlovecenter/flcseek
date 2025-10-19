import { Pool } from '@neondatabase/serverless';

const neonConnectionString = process.env.NEON_DATABASE_URL!;

export const pool = new Pool({ connectionString: neonConnectionString });

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}
