import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkCurrentState() {
  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ No database connection string found');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('📊 Checking current database state...\n');

    // Check streams
    const streams = await pool.query('SELECT COUNT(*) FROM streams');
    console.log(`Streams: ${streams.rows[0].count}`);

    // Check groups
    const groups = await pool.query('SELECT id, name, stream_id FROM groups ORDER BY name');
    console.log(`\nGroups: ${groups.rows.length}`);
    
    if (groups.rows.length > 0) {
      console.log('\nCurrent groups:');
      groups.rows.forEach(g => {
        console.log(`  - ${g.name} (stream_id: ${g.stream_id || 'NULL'})`);
      });
    }

    // Check users with roles
    const users = await pool.query(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role 
      ORDER BY role
    `);
    
    console.log('\nUsers by role:');
    users.rows.forEach(r => {
      console.log(`  - ${r.role}: ${r.count}`);
    });

    // Check if any users are assigned as stream leaders
    const streamLeaders = await pool.query(`
      SELECT id, username, role, stream_id 
      FROM users 
      WHERE role = 'stream_leader'
    `);
    
    console.log(`\nStream leaders: ${streamLeaders.rows.length}`);
    if (streamLeaders.rows.length > 0) {
      streamLeaders.rows.forEach(u => {
        console.log(`  - ${u.username} (stream_id: ${u.stream_id || 'NULL'})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkCurrentState();
