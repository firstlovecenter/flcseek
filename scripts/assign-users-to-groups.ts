import 'dotenv/config';
import { query } from '../lib/neon';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

async function assignUsersToGroups() {
  try {
    console.log('🔄 Starting user-to-group assignment...\n');

    // Step 1: Get all groups
    console.log('📋 Fetching groups from database...');
    const groupsResult = await query(
      'SELECT id, name FROM groups ORDER BY name'
    );
    const groups = groupsResult.rows;
    console.log(`✅ Found ${groups.length} groups:`, groups.map(g => g.name).join(', '));

    if (groups.length !== 12) {
      console.error(`❌ Expected 12 groups but found ${groups.length}`);
      process.exit(1);
    }

    console.log('\n🔄 Assigning users to groups...\n');

    // Step 2: Assign each admin to their corresponding group
    console.log('👤 Assigning ADMINS to groups:');
    for (const month of months) {
      // Find group that contains the month name (case-insensitive)
      const group = groups.find(g => 
        g.name.toLowerCase().includes(month.toLowerCase())
      );
      
      if (!group) {
        console.error(`❌ Group not found for month: ${month}`);
        continue;
      }

      const username = `${month.toLowerCase()}_admin`;
      
      const updateResult = await query(
        `UPDATE users 
         SET group_id = $1, group_name = $2 
         WHERE username = $3
         RETURNING id, username, role, group_name`,
        [group.id, month, username]
      );

      if (updateResult.rowCount && updateResult.rowCount > 0) {
        console.log(`  ✅ ${username} → ${group.name} (group_id: ${group.id})`);
      } else {
        console.log(`  ⚠️  ${username} not found in database`);
      }
    }

    // Step 3: Assign each leader to their corresponding group
    console.log('\n👤 Assigning LEADERS to groups:');
    for (const month of months) {
      // Find group that contains the month name (case-insensitive)
      const group = groups.find(g => 
        g.name.toLowerCase().includes(month.toLowerCase())
      );
      
      if (!group) {
        console.error(`❌ Group not found for month: ${month}`);
        continue;
      }

      const username = `${month.toLowerCase()}_leader`;
      
      const updateResult = await query(
        `UPDATE users 
         SET group_id = $1, group_name = $2 
         WHERE username = $3
         RETURNING id, username, role, group_name`,
        [group.id, month, username]
      );

      if (updateResult.rowCount && updateResult.rowCount > 0) {
        console.log(`  ✅ ${username} → ${group.name} (group_id: ${group.id})`);
      } else {
        console.log(`  ⚠️  ${username} not found in database`);
      }
    }

    // Step 4: Verify the assignments
    console.log('\n📊 Verifying assignments...');
    const verifyResult = await query(
      `SELECT username, role, group_name, group_id 
       FROM users 
       WHERE role IN ('admin', 'leader') 
       ORDER BY group_name, role`
    );

    console.log(`\n✅ Total users assigned: ${verifyResult.rows.length}`);
    
    // Group by month
    const byMonth: { [key: string]: any[] } = {};
    verifyResult.rows.forEach(user => {
      if (!byMonth[user.group_name]) {
        byMonth[user.group_name] = [];
      }
      byMonth[user.group_name].push(user);
    });

    console.log('\n📋 Assignment Summary:');
    console.log('═'.repeat(80));
    Object.keys(byMonth).sort().forEach(month => {
      const users = byMonth[month];
      const admin = users.find(u => u.role === 'admin');
      const leader = users.find(u => u.role === 'leader');
      
      console.log(`\n${month}:`);
      if (admin) {
        console.log(`  Admin:  ${admin.username} (group_id: ${admin.group_id})`);
      } else {
        console.log(`  Admin:  ❌ NOT ASSIGNED`);
      }
      if (leader) {
        console.log(`  Leader: ${leader.username} (group_id: ${leader.group_id})`);
      } else {
        console.log(`  Leader: ❌ NOT ASSIGNED`);
      }
    });

    console.log('\n' + '═'.repeat(80));
    console.log('✅ USER-TO-GROUP ASSIGNMENT COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

assignUsersToGroups()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
