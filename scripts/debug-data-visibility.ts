import 'dotenv/config';
import { query } from '../lib/neon';

async function debugDataVisibility() {
  try {
    console.log('🔍 Debugging data visibility issue...\n');

    // Check total registered people
    const totalResult = await query(
      'SELECT COUNT(*) as total FROM registered_people'
    );
    console.log(`📊 Total registered people in database: ${totalResult.rows[0].total}`);

    // Check by group
    const byGroupResult = await query(
      `SELECT group_name, COUNT(*) as count 
       FROM registered_people 
       GROUP BY group_name 
       ORDER BY group_name`
    );
    
    console.log('\n📋 People per group:');
    console.log('═'.repeat(80));
    byGroupResult.rows.forEach(row => {
      console.log(`${row.group_name.padEnd(20)} : ${row.count} people`);
    });

    // Check january_admin user specifically
    console.log('\n\n🔍 Checking january_admin user...');
    const userResult = await query(
      `SELECT id, username, role, group_name, group_id 
       FROM users 
       WHERE username = 'january_admin'`
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log('User details:');
      console.log(`  Username: ${user.username}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Group Name: ${user.group_name}`);
      console.log(`  Group ID: ${user.group_id}`);

      // Check people for this group
      if (user.group_id) {
        const peopleResult = await query(
          `SELECT COUNT(*) as count 
           FROM registered_people 
           WHERE group_id = $1`,
          [user.group_id]
        );
        console.log(`  People with same group_id: ${peopleResult.rows[0].count}`);

        // Sample some people
        const sampleResult = await query(
          `SELECT id, full_name, phone_number, group_name, group_id 
           FROM registered_people 
           WHERE group_id = $1 
           LIMIT 5`,
          [user.group_id]
        );
        
        console.log('\n  Sample people in this group:');
        sampleResult.rows.forEach((person, i) => {
          console.log(`  ${i + 1}. ${person.full_name} (${person.phone_number})`);
          console.log(`     Group Name: ${person.group_name}, Group ID: ${person.group_id}`);
        });
      }
    } else {
      console.log('❌ User not found!');
    }

    // Check the API endpoint logic simulation
    console.log('\n\n🔍 Simulating API logic for january_admin...');
    const adminUser = userResult.rows[0];
    
    // This is what the API should be doing
    let peopleQuery = 'SELECT * FROM registered_people';
    let params: any[] = [];

    if (adminUser.role === 'admin' && adminUser.group_id) {
      peopleQuery += ' WHERE group_id = $1';
      params = [adminUser.group_id];
    }

    const apiSimResult = await query(peopleQuery + ' LIMIT 10', params);
    console.log(`API would return ${apiSimResult.rows.length} people (showing first 10)`);
    
    if (apiSimResult.rows.length > 0) {
      console.log('\nSample results:');
      apiSimResult.rows.slice(0, 3).forEach((person, i) => {
        console.log(`  ${i + 1}. ${person.full_name} - ${person.phone_number}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

debugDataVisibility()
  .then(() => {
    console.log('\n✅ Debug completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  });
