import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const sql = neon(process.env.NEON_DATABASE_URL!);

// Define your custom group name mappings here
// Format: 'CurrentName' -> 'NewName'
const GROUP_MAPPINGS: Record<string, string> = {
  'January': 'eXp-January',
  'February': 'HGE-February',
  'March': 'HGE-March',
  'April': 'HGE-April',
  'May': 'HGE-May',
  'June': 'HGE-June',
  'July': 'HGE-July',
  'August': 'HGE-August',
  'September': 'HGE-September',
  'October': 'HGE-October',
  'November': 'HGE-November',
  'December': 'HGE-December',
};

async function restoreGroupPrefixes() {
  console.log('🔄 Restoring custom group name prefixes...\n');

  try {
    // Get current groups
    const currentGroups = await sql`SELECT name FROM groups ORDER BY name`;
    console.log('📋 Current groups in database:');
    currentGroups.forEach((g: any) => console.log(`  - ${g.name}`));
    console.log();

    // Apply mappings
    for (const [oldName, newName] of Object.entries(GROUP_MAPPINGS)) {
      if (oldName === newName) {
        console.log(`⏭️  Skipping "${oldName}" (already correct)`);
        continue;
      }

      console.log(`🔧 Updating: "${oldName}" → "${newName}"`);

      // Update groups table
      const groupResult = await sql`
        UPDATE groups 
        SET name = ${newName} 
        WHERE name = ${oldName}
        RETURNING *
      `;
      console.log(`  ✅ Updated groups table (${groupResult.length} rows)`);

      // Update registered_people table
      const peopleResult = await sql`
        UPDATE registered_people 
        SET group_name = ${newName} 
        WHERE group_name = ${oldName}
        RETURNING id
      `;
      console.log(`  ✅ Updated registered_people (${peopleResult.length} people)`);

      // Update users table
      const usersResult = await sql`
        UPDATE users 
        SET group_name = ${newName} 
        WHERE group_name = ${oldName}
        RETURNING id
      `;
      console.log(`  ✅ Updated users (${usersResult.length} users)\n`);
    }

    // Verify final state
    console.log('\n✅ Update complete! Final groups:');
    const finalGroups = await sql`SELECT name FROM groups ORDER BY name`;
    finalGroups.forEach((g: any) => console.log(`  - ${g.name}`));

    console.log('\n📊 Verification:');
    const peopleByGroup = await sql`
      SELECT group_name, COUNT(*) as count 
      FROM registered_people 
      GROUP BY group_name 
      ORDER BY group_name
    `;
    peopleByGroup.forEach((g: any) => {
      console.log(`  - ${g.group_name}: ${g.count} people`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

restoreGroupPrefixes().then(() => {
  console.log('\n🎉 All done!');
  process.exit(0);
}).catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});
