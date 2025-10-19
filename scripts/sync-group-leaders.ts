import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.NEON_DATABASE_URL;

// Sync group leaders based on user assignments
async function syncGroupLeaders() {
  const pool = new Pool({ connectionString });
  
  try {
    const client = await pool.connect();
    
    console.log('🔄 Syncing group leaders...\n');
    
    // Get all users with group assignments and role sheep_seeker
    const usersResult = await client.query(`
      SELECT id, group_name, first_name, last_name
      FROM users 
      WHERE role = 'sheep_seeker' AND group_name IS NOT NULL
      ORDER BY group_name
    `);
    
    console.log(`Found ${usersResult.rows.length} sheep seekers with group assignments\n`);
    
    // Update groups table with leader_id
    for (const user of usersResult.rows) {
      try {
        await client.query(
          `UPDATE groups 
           SET leader_id = $1, updated_at = NOW()
           WHERE name = $2`,
          [user.id, user.group_name]
        );
        
        console.log(`✅ Updated ${user.group_name} leader: ${user.first_name} ${user.last_name}`);
      } catch (error) {
        console.error(`❌ Failed to update ${user.group_name}:`, error);
      }
    }
    
    // Show summary
    console.log('\n📊 Group Leaders Summary:');
    const groupsResult = await client.query(`
      SELECT 
        g.name,
        g.leader_id,
        u.first_name,
        u.last_name,
        u.username
      FROM groups g
      LEFT JOIN users u ON g.leader_id = u.id
      ORDER BY g.name
    `);
    
    groupsResult.rows.forEach(group => {
      if (group.leader_id) {
        console.log(`   ${group.name}: ${group.first_name} ${group.last_name} (${group.username})`);
      } else {
        console.log(`   ${group.name}: No leader assigned`);
      }
    });
    
    client.release();
    await pool.end();
    
    console.log('\n✅ Sync complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

syncGroupLeaders();
