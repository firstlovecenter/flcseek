import { Pool } from '@neondatabase/serverless';

async function removeStreams() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  
  try {
    console.log('Starting streams removal...\n');
    
    // 1. Remove foreign key constraints and columns from groups table
    console.log('Removing stream_id from groups table...');
    await pool.query(`
      ALTER TABLE groups 
      DROP CONSTRAINT IF EXISTS groups_stream_id_fkey,
      DROP COLUMN IF EXISTS stream_id;
    `);
    console.log('✅ Removed stream_id from groups table\n');
    
    // 2. Remove foreign key constraints and columns from users table
    console.log('Removing stream_id from users table...');
    await pool.query(`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS users_stream_id_fkey,
      DROP COLUMN IF EXISTS stream_id;
    `);
    console.log('✅ Removed stream_id from users table\n');
    
    // 3. Drop the streams table
    console.log('Dropping streams table...');
    await pool.query(`DROP TABLE IF EXISTS streams;`);
    console.log('✅ Dropped streams table\n');
    
    console.log('🎉 Streams removal completed successfully!');
    
  } catch (error) {
    console.error('❌ Error removing streams:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

removeStreams();
