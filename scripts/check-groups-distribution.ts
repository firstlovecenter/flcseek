import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function checkGroups() {
  console.log('\n🔍 Checking Groups and People Distribution...\n');

  // Get all groups
  const groupsResult = await sql`SELECT * FROM groups ORDER BY name`;
  console.log(`📋 Total Groups: ${groupsResult.length}\n`);

  for (const group of groupsResult) {
    // Count people in each group
    const peopleResult = await sql`
      SELECT COUNT(*) as count 
      FROM registered_people 
      WHERE group_name = ${group.name}
    `;
    
    const count = peopleResult[0].count;
    console.log(`  ${group.name}: ${count} people`);
  }

  // Check for people with group names not in groups table
  console.log('\n\n🔍 Checking for orphaned group names...\n');
  
  const distinctGroups = await sql`
    SELECT DISTINCT group_name, COUNT(*) as count 
    FROM registered_people 
    GROUP BY group_name 
    ORDER BY group_name
  `;
  
  console.log(`📊 Distinct group names in registered_people: ${distinctGroups.length}\n`);
  
  for (const g of distinctGroups) {
    const existsInGroupsTable = await sql`SELECT id FROM groups WHERE name = ${g.group_name}`;
    const status = existsInGroupsTable.length > 0 ? '✅' : '❌ NOT IN GROUPS TABLE';
    console.log(`  ${g.group_name}: ${g.count} people ${status}`);
  }
}

checkGroups()
  .then(() => {
    console.log('\n✅ Check complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
