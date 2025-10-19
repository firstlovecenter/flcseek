import { Pool } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error('❌ NEON_DATABASE_URL not found in environment variables');
  console.error('Make sure your .env file exists and contains NEON_DATABASE_URL');
  process.exit(1);
}

async function runMigration() {
  const pool = new Pool({ connectionString });
  
  try {
    console.log('📦 Reading migration file...');
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '003b_create_groups_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('🚀 Running migration 003b: Create groups table...');
    
    const client = await pool.connect();
    try {
      await client.query(migrationSQL);
      console.log('✅ Migration 003b completed successfully!');
      console.log('✅ Table created: groups');
      console.log('✅ Column renamed: department_name → group_name');
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
