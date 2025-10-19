import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const sql = neon(process.env.NEON_DATABASE_URL!);

const CLEAN_GROUPS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

async function fixAllGroupNames() {
  console.log('\n🔧 Fixing All Group Names...\n');

  try {
    // Get all unique group names in registered_people
    const currentGroups = await sql`
      SELECT DISTINCT group_name 
      FROM registered_people 
      ORDER BY group_name
    `;

    console.log('Current groups in database:');
    currentGroups.forEach((g: any) => console.log(`  - ${g.group_name}`));

    console.log('\n📝 Updating group names...\n');

    for (const currentGroup of currentGroups) {
      const groupName = currentGroup.group_name;
      
      // Extract the month name from various formats
      let cleanName = groupName;
      
      // Remove prefixes like HGE-, eXp-, etc.
      if (groupName.includes('-')) {
        cleanName = groupName.split('-')[1] || groupName;
      }
      
      // Check if it's a valid month
      if (CLEAN_GROUPS.includes(cleanName) && cleanName !== groupName) {
        console.log(`  Updating: "${groupName}" → "${cleanName}"`);
        
        await sql`
          UPDATE registered_people 
          SET group_name = ${cleanName}
          WHERE group_name = ${groupName}
        `;
        
        console.log(`    ✅ Updated registered_people`);
      }
    }

    // Also update users table
    const currentUserGroups = await sql`
      SELECT DISTINCT group_name 
      FROM users 
      WHERE group_name IS NOT NULL
      ORDER BY group_name
    `;

    console.log('\n📝 Updating user group names...\n');

    for (const currentGroup of currentUserGroups) {
      const groupName = currentGroup.group_name;
      
      let cleanName = groupName;
      
      if (groupName.includes('-')) {
        cleanName = groupName.split('-')[1] || groupName;
      }
      
      if (CLEAN_GROUPS.includes(cleanName) && cleanName !== groupName) {
        console.log(`  Updating user: "${groupName}" → "${cleanName}"`);
        
        await sql`
          UPDATE users 
          SET group_name = ${cleanName}
          WHERE group_name = ${groupName}
        `;
        
        console.log(`    ✅ Updated users`);
      }
    }

    // Also update groups table if it exists
    try {
      const currentGroupsTable = await sql`
        SELECT DISTINCT name 
        FROM groups 
        ORDER BY name
      `;

      console.log('\n📝 Updating groups table...\n');

      for (const currentGroup of currentGroupsTable) {
        const groupName = currentGroup.name;
        
        let cleanName = groupName;
        
        if (groupName.includes('-')) {
          cleanName = groupName.split('-')[1] || groupName;
        }
        
        if (CLEAN_GROUPS.includes(cleanName) && cleanName !== groupName) {
          console.log(`  Updating group: "${groupName}" → "${cleanName}"`);
          
          await sql`
            UPDATE groups 
            SET name = ${cleanName}
            WHERE name = ${groupName}
          `;
          
          console.log(`    ✅ Updated groups table`);
        }
      }
    } catch (error) {
      console.log('  ℹ️  Groups table not found or error updating it');
    }

    // Verify the changes
    console.log('\n✅ Verification:\n');
    
    const finalGroups = await sql`
      SELECT group_name, COUNT(*) as count 
      FROM registered_people 
      GROUP BY group_name 
      ORDER BY group_name
    `;

    console.log('Final groups in registered_people:');
    finalGroups.forEach((g: any) => {
      console.log(`  - ${g.group_name}: ${g.count} people`);
    });

    console.log('\n🎉 Group name fix complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixAllGroupNames();
