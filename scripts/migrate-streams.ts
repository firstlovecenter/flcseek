import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runMigration() {
  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ No database connection string found');
    console.error('Please set NEON_DATABASE_URL or DATABASE_URL in your .env file');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('🔄 Running streams architecture migration...\n');

    // Read the migration file
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/003_add_streams_and_roles.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify the tables were created
    console.log('🔍 Verifying new tables...\n');

    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('streams', 'groups')
      ORDER BY table_name;
    `);

    console.log('Tables created:');
    tableCheck.rows.forEach((row) => {
      console.log(`  ✅ ${row.table_name}`);
    });

    // Check updated users columns
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('stream_id', 'group_id')
      ORDER BY column_name;
    `);

    console.log('\nUsers table columns added:');
    columnCheck.rows.forEach((row) => {
      console.log(`  ✅ ${row.column_name}`);
    });

    console.log('\n✨ Streams architecture is ready to use!');
    console.log('\nNext steps:');
    console.log('1. Create streams via super admin UI');
    console.log('2. Assign stream leaders to streams');
    console.log('3. Create groups under streams (6-month lifecycle)');
    console.log('4. Assign sheep seekers to groups\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
