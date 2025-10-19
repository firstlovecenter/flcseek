import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.NEON_DATABASE_URL;

async function checkGroups() {
  const pool = new Pool({ connectionString });
  
  try {
    const client = await pool.connect();
    
    console.log('🔍 Checking groups table...\n');
    
    // Count groups
    const countResult = await client.query('SELECT COUNT(*) FROM groups;');
    console.log(`📊 Total groups: ${countResult.rows[0].count}`);
    
    // Get all groups
    const groupsResult = await client.query('SELECT id, name, description, leader_id, created_at FROM groups ORDER BY name;');
    
    if (groupsResult.rows.length > 0) {
      console.log('\n📋 Groups in database:');
      groupsResult.rows.forEach((group, index) => {
        console.log(`\n${index + 1}. ${group.name}`);
        console.log(`   ID: ${group.id}`);
        console.log(`   Description: ${group.description || 'N/A'}`);
        console.log(`   Leader ID: ${group.leader_id || 'Not assigned'}`);
        console.log(`   Created: ${group.created_at}`);
      });
    } else {
      console.log('\n⚠️  No groups found in the database!');
      console.log('\n💡 You need to populate the groups table with the 12 church groups.');
    }
    
    // Check if there are any registered people
    const peopleCount = await client.query('SELECT COUNT(*) FROM registered_people;');
    console.log(`\n👥 Total registered people: ${peopleCount.rows[0].count}`);
    
    // Check what group_names are being used
    const groupNames = await client.query(`
      SELECT DISTINCT group_name, COUNT(*) as count 
      FROM registered_people 
      WHERE group_name IS NOT NULL 
      GROUP BY group_name 
      ORDER BY group_name;
    `);
    
    if (groupNames.rows.length > 0) {
      console.log('\n📝 Group names used in registered_people:');
      groupNames.rows.forEach(row => {
        console.log(`   - ${row.group_name}: ${row.count} people`);
      });
    }
    
    client.release();
    await pool.end();
    
    console.log('\n✅ Database check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkGroups();
