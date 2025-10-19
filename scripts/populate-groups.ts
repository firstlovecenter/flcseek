import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.NEON_DATABASE_URL;

// The 12 groups (months)
const GROUPS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

async function populateGroups() {
  const pool = new Pool({ connectionString });
  
  try {
    const client = await pool.connect();
    
    console.log('🚀 Populating groups table with 12 month groups...\n');
    
    for (const groupName of GROUPS) {
      try {
        const result = await client.query(
          `INSERT INTO groups (name, description) 
           VALUES ($1, $2) 
           ON CONFLICT (name) DO NOTHING 
           RETURNING id, name;`,
          [groupName, `${groupName} group for church members`]
        );
        
        if (result.rows.length > 0) {
          console.log(`✅ Created group: ${result.rows[0].name}`);
        } else {
          console.log(`ℹ️  Group already exists: ${groupName}`);
        }
      } catch (error) {
        console.error(`❌ Error creating group ${groupName}:`, error);
      }
    }
    
    // Verify the results
    console.log('\n📊 Verifying groups table...');
    const countResult = await client.query('SELECT COUNT(*) FROM groups;');
    console.log(`✅ Total groups in database: ${countResult.rows[0].count}`);
    
    // Show all groups
    const allGroups = await client.query('SELECT name FROM groups ORDER BY name;');
    console.log('\n📋 All groups:');
    allGroups.rows.forEach((group, index) => {
      console.log(`   ${index + 1}. ${group.name}`);
    });
    
    client.release();
    await pool.end();
    
    console.log('\n✅ Groups table populated successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

populateGroups();
