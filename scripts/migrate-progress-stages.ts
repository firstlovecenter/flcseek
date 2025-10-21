import { Pool } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: No database connection string found!');
  console.error('Please set NEON_DATABASE_URL or DATABASE_URL in your .env file');
  console.error('\nCreate a .env file in the project root with:');
  console.error('NEON_DATABASE_URL=your_neon_connection_string_here');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running progress_stages migration...\n');

    // Read the migration file
    const migrationPath = path.join(
      process.cwd(),
      'db',
      'migrations',
      '002_create_progress_stages.sql'
    );

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute the entire migration as one transaction
    console.log('Executing migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration executed successfully\n');

    // Verify the data
    console.log('Verifying milestones...');
    const result = await client.query(`
      SELECT stage_number, stage_name 
      FROM progress_stages 
      ORDER BY stage_number
    `);

    console.log(`\n✅ Migration complete! ${result.rows.length} milestones created:\n`);
    result.rows.forEach((m: any) => {
      console.log(`   ${m.stage_number}. ${m.stage_name}`);
    });

    console.log('\n🎉 All done!');
    process.exit(0);
  } catch (error: any) {
    // Check if it's just a "already exists" error
    if (error.message?.includes('already exists')) {
      console.log('⚠️  Table already exists, verifying data...\n');
      
      try {
        const result = await client.query(`
          SELECT stage_number, stage_name 
          FROM progress_stages 
          ORDER BY stage_number
        `);

        console.log(`✅ Found ${result.rows.length} existing milestones:\n`);
        result.rows.forEach((m: any) => {
          console.log(`   ${m.stage_number}. ${m.stage_name}`);
        });

        console.log('\n🎉 Database is already set up!');
        process.exit(0);
      } catch (verifyError) {
        console.error('❌ Error verifying data:', verifyError);
        process.exit(1);
      }
    } else {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
