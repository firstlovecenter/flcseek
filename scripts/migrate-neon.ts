import { Pool } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const connectionString = process.env.NEON_DATABASE_URL;
  
  if (!connectionString) {
    console.error('Error: NEON_DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('Connecting to Neon database...');
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/001_neon_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    await pool.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('\nDefault login credentials:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('\n⚠️  Remember to change the default password after first login!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
