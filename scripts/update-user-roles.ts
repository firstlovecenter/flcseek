import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function updateUserRoles() {
  console.log('🔄 Starting user role migration...\n');

  try {
    // Step 1: Show current role distribution
    console.log('📊 Current role distribution:');
    const currentRoles = await sql`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role 
      ORDER BY role
    `;
    currentRoles.forEach((row: any) => {
      console.log(`   ${row.role || 'NULL'}: ${row.count} users`);
    });
    console.log('');

    // Step 2: Update the role check constraint to include new roles
    console.log('🔧 Updating role constraint...');
    await sql`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS users_role_check
    `;
    
    await sql`
      ALTER TABLE users 
      ADD CONSTRAINT users_role_check 
      CHECK (role IN ('superadmin', 'leadpastor', 'admin', 'leader', 'super_admin', 'lead_pastor', 'stream_leader', 'sheep_seeker'))
    `;
    console.log('   ✅ Role constraint updated to allow both old and new roles\n');

    // Step 3: Migrate roles
    console.log('🔄 Migrating user roles:');
    
    // super_admin → superadmin
    const superAdminResult = await sql`
      UPDATE users 
      SET role = 'superadmin' 
      WHERE role = 'super_admin'
      RETURNING id, username
    `;
    console.log(`   ✅ Updated ${superAdminResult.length} super_admin → superadmin`);

    // lead_pastor → leadpastor
    const leadPastorResult = await sql`
      UPDATE users 
      SET role = 'leadpastor' 
      WHERE role = 'lead_pastor'
      RETURNING id, username
    `;
    console.log(`   ✅ Updated ${leadPastorResult.length} lead_pastor → leadpastor`);

    // stream_leader → admin
    const streamLeaderResult = await sql`
      UPDATE users 
      SET role = 'admin' 
      WHERE role = 'stream_leader'
      RETURNING id, username
    `;
    console.log(`   ✅ Updated ${streamLeaderResult.length} stream_leader → admin`);

    // sheep_seeker → leader
    const sheepSeekerResult = await sql`
      UPDATE users 
      SET role = 'leader' 
      WHERE role = 'sheep_seeker'
      RETURNING id, username
    `;
    console.log(`   ✅ Updated ${sheepSeekerResult.length} sheep_seeker → leader\n`);

    // Step 4: Show new role distribution
    console.log('📊 New role distribution:');
    const newRoles = await sql`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role 
      ORDER BY role
    `;
    newRoles.forEach((row: any) => {
      console.log(`   ${row.role || 'NULL'}: ${row.count} users`);
    });
    console.log('');

    // Step 5: Update constraint to only allow new roles
    console.log('🔒 Finalizing role constraint to only allow new roles...');
    await sql`
      ALTER TABLE users 
      DROP CONSTRAINT users_role_check
    `;
    
    await sql`
      ALTER TABLE users 
      ADD CONSTRAINT users_role_check 
      CHECK (role IN ('superadmin', 'leadpastor', 'admin', 'leader'))
    `;
    console.log('   ✅ Role constraint updated to only allow new roles\n');

    console.log('✅ User role migration completed successfully!\n');
    console.log('Summary:');
    console.log(`   - ${superAdminResult.length} users: super_admin → superadmin`);
    console.log(`   - ${leadPastorResult.length} users: lead_pastor → leadpastor`);
    console.log(`   - ${streamLeaderResult.length} users: stream_leader → admin`);
    console.log(`   - ${sheepSeekerResult.length} users: sheep_seeker → leader`);
    console.log(`   - Total: ${superAdminResult.length + leadPastorResult.length + streamLeaderResult.length + sheepSeekerResult.length} users updated`);

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

updateUserRoles();
