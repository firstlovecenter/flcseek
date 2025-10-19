import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const sql = neon(process.env.NEON_DATABASE_URL!);

const GROUPS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

async function fixGroupNames() {
  console.log('\n🔧 Fixing Group Names (Removing HGE- prefix)...\n');

  for (const group of GROUPS) {
    const oldName = `HGE-${group}`;
    const newName = group;

    console.log(`  Updating: ${oldName} → ${newName}`);

    // Update the group name
    await sql`
      UPDATE groups 
      SET name = ${newName}
      WHERE name = ${oldName}
    `;
  }

  // Update user's group_name if they have HGE- prefix
  console.log('\n🔧 Updating user group assignments...\n');
  
  const usersWithHGE = await sql`
    SELECT id, email, group_name 
    FROM users 
    WHERE group_name LIKE 'HGE-%'
  `;

  console.log(`Found ${usersWithHGE.length} users with HGE- prefix in group_name`);

  for (const user of usersWithHGE) {
    const newGroupName = user.group_name.replace('HGE-', '');
    console.log(`  ${user.email}: ${user.group_name} → ${newGroupName}`);
    
    await sql`
      UPDATE users 
      SET group_name = ${newGroupName}
      WHERE id = ${user.id}
    `;
  }

  console.log('\n✅ Group names fixed!');
  console.log('\nVerifying...\n');

  // Verify
  const groups = await sql`SELECT name FROM groups ORDER BY name`;
  console.log('📋 Groups now:');
  groups.forEach((g: any) => console.log(`  - ${g.name}`));

  const users = await sql`
    SELECT email, group_name 
    FROM users 
    WHERE role = 'sheep_seeker' AND group_name IS NOT NULL
    ORDER BY email
  `;
  
  console.log('\n👥 Sheep seeker group assignments:');
  users.forEach((u: any) => console.log(`  - ${u.email}: ${u.group_name}`));
}

fixGroupNames()
  .then(() => {
    console.log('\n✅ Complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
