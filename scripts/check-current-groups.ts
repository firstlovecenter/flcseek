import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function checkGroups() {
  console.log('🔍 Checking current group names in database...\n');

  // Check groups table
  const groups = await sql`
    SELECT name, created_at 
    FROM groups 
    ORDER BY name
  `;
  
  console.log('📋 Groups table:');
  groups.forEach((g: any) => {
    console.log(`  - ${g.name}`);
  });
  console.log(`  Total: ${groups.length} groups\n`);

  // Check registered_people
  const peopleGroups = await sql`
    SELECT group_name, COUNT(*) as count 
    FROM registered_people 
    GROUP BY group_name 
    ORDER BY group_name
  `;
  
  console.log('👥 Registered people by group_name:');
  peopleGroups.forEach((g: any) => {
    console.log(`  - ${g.group_name}: ${g.count} people`);
  });
  console.log(`  Total people: ${peopleGroups.reduce((sum: number, g: any) => sum + parseInt(g.count), 0)}\n`);

  // Check users table
  const userGroups = await sql`
    SELECT group_name, COUNT(*) as count 
    FROM users 
    WHERE group_name IS NOT NULL
    GROUP BY group_name 
    ORDER BY group_name
  `;
  
  console.log('🔐 Users by group_name:');
  if (userGroups.length > 0) {
    userGroups.forEach((g: any) => {
      console.log(`  - ${g.group_name}: ${g.count} users`);
    });
  } else {
    console.log('  (No users with group_name set)');
  }
}

checkGroups().catch(console.error);
