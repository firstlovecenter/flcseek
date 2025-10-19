import { Pool } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error('❌ NEON_DATABASE_URL not found in environment variables');
  process.exit(1);
}

async function runMigration() {
  const pool = new Pool({ connectionString });
  
  try {
    console.log('📦 Reading migration file...');
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '005_add_group_name_to_users.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('🚀 Running migration 005: Add group_name to users table...');
    
    const client = await pool.connect();
    try {
      await client.query(migrationSQL);
      console.log('✅ Migration 005 completed successfully!');
      console.log('✅ Column added: users.group_name');
    } finally {
      client.release();
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
