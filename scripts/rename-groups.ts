import 'dotenv/config';
import { query } from '../lib/neon';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

async function renameGroups() {
  try {
    console.log('🔄 Renaming groups to remove prefixes...\n');

    // Get all groups
    const groupsResult = await query(
      'SELECT id, name FROM groups ORDER BY name'
    );
    const groups = groupsResult.rows;

    console.log('📋 Current groups:');
    console.log('═'.repeat(80));
    groups.forEach(group => {
      console.log(`  - ${group.name}`);
    });

    console.log('\n🔄 Updating group names...\n');

    for (const group of groups) {
      // Find which month this group belongs to
      const month = monthNames.find(m => 
        group.name.toLowerCase().includes(m.toLowerCase())
      );

      if (month) {
        // Update group name
        await query(
          'UPDATE groups SET name = $1 WHERE id = $2',
          [month, group.id]
        );
        console.log(`  ✅ ${group.name.padEnd(20)} → ${month}`);

        // Update registered_people group_name
        const updatePeopleResult = await query(
          'UPDATE registered_people SET group_name = $1 WHERE group_id = $2',
          [month, group.id]
        );
        console.log(`     Updated ${updatePeopleResult.rowCount} registered people`);

        // Update users group_name
        const updateUsersResult = await query(
          'UPDATE users SET group_name = $1 WHERE group_id = $2',
          [month, group.id]
        );
        console.log(`     Updated ${updateUsersResult.rowCount} users`);
      } else {
        console.log(`  ⚠️  Could not find month for: ${group.name}`);
      }
    }

    // Verify the changes
    console.log('\n📊 Verifying changes...');
    const verifyResult = await query(
      'SELECT id, name FROM groups ORDER BY name'
    );

    console.log('\n✅ Updated groups:');
    console.log('═'.repeat(80));
    verifyResult.rows.forEach(group => {
      console.log(`  - ${group.name}`);
    });

    // Check for any data integrity issues
    console.log('\n🔍 Checking data integrity...');
    
    const peopleCheck = await query(
      `SELECT group_name, COUNT(*) as count 
       FROM registered_people 
       GROUP BY group_name 
       ORDER BY group_name`
    );

    console.log('\n📈 People per group:');
    console.log('─'.repeat(80));
    peopleCheck.rows.forEach(row => {
      console.log(`${row.group_name.padEnd(20)} : ${row.count} people`);
    });

    console.log('\n' + '═'.repeat(80));
    console.log('✅ GROUP RENAME COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

renameGroups()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
