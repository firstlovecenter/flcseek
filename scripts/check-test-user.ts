import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function checkUser() {
  console.log('\n🔍 Checking test@test.com user...\n');

  // Find the user
  const userResult = await sql`SELECT * FROM users WHERE email = 'test@test.com'`;
  
  if (userResult.length === 0) {
    console.log('❌ User test@test.com not found in database');
    return;
  }

  const user = userResult[0];
  console.log('✅ User found:');
  console.log(`  - ID: ${user.id}`);
  console.log(`  - Email: ${user.email}`);
  console.log(`  - Role: ${user.role}`);
  console.log(`  - Group: ${user.group_name || 'NOT ASSIGNED'}`);
  console.log(`  - First Name: ${user.first_name}`);
  console.log(`  - Last Name: ${user.last_name}`);

  if (user.role === 'sheep_seeker' && user.group_name) {
    // Check if there are people in their group
    const peopleResult = await sql`
      SELECT id, full_name, phone_number 
      FROM registered_people 
      WHERE group_name = ${user.group_name}
      LIMIT 10
    `;
    
    console.log(`\n📊 People in ${user.group_name} group: ${peopleResult.length}`);
    
    if (peopleResult.length > 0) {
      console.log('\nSample people:');
      peopleResult.forEach((person: any) => {
        console.log(`  - ${person.full_name} (${person.phone_number})`);
      });
    } else {
      console.log(`\n⚠️  No people registered in ${user.group_name} group!`);
    }
  } else if (user.role === 'super_admin') {
    // Count all people
    const totalResult = await sql`SELECT COUNT(*) as count FROM registered_people`;
    console.log(`\n📊 Total people in system: ${totalResult[0].count}`);
  } else {
    console.log('\n⚠️  User is sheep_seeker but has no group assigned!');
  }

  // Check group assignment in groups table
  if (user.group_name) {
    const groupResult = await sql`SELECT * FROM groups WHERE name = ${user.group_name}`;
    if (groupResult.length > 0) {
      const group = groupResult[0];
      console.log(`\n📋 Group Details:`);
      console.log(`  - Name: ${group.name}`);
      console.log(`  - Leader ID: ${group.leader_id}`);
      console.log(`  - Is Leader: ${group.leader_id === user.id ? 'YES ✅' : 'NO ❌'}`);
    }
  }
}

checkUser()
  .then(() => {
    console.log('\n✅ Check complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
