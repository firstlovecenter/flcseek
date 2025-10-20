import * as dotenv from 'dotenv';
import * as path from 'path';
import { neon } from '@neondatabase/serverless';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Database connection string not found in environment variables');
}

const sql = neon(connectionString);

async function migrateMembersToGroups() {
  console.log('Starting migration: Attaching members to groups via group_id...\n');

  try {
    // 1. Check current state
    console.log('1. Checking current state...');
    const totalMembers = await sql`SELECT COUNT(*) as count FROM registered_people`;
    const membersWithGroupId = await sql`SELECT COUNT(*) as count FROM registered_people WHERE group_id IS NOT NULL`;
    const membersWithGroupName = await sql`SELECT COUNT(*) as count FROM registered_people WHERE group_name IS NOT NULL`;
    
    console.log(`   Total members: ${totalMembers[0].count}`);
    console.log(`   Members with group_id: ${membersWithGroupId[0].count}`);
    console.log(`   Members with group_name: ${membersWithGroupName[0].count}\n`);

    // 2. Get all groups
    console.log('2. Fetching groups...');
    const groups = await sql`
      SELECT id, name, stream_id, 
             (SELECT name FROM streams WHERE id = stream_id) as stream_name
      FROM groups 
      ORDER BY name
    `;
    console.log(`   Found ${groups.length} groups:\n`);
    groups.forEach(g => {
      console.log(`   - ${g.name} (Stream: ${g.stream_name || 'None'})`);
    });

    // 3. Update registered_people to set group_id based on group_name
    console.log('\n3. Updating registered_people with group_id...');
    
    for (const group of groups) {
      const result = await sql`
        UPDATE registered_people 
        SET group_id = ${group.id}
        WHERE group_name = ${group.name}
        AND group_id IS NULL
      `;
      
      if (result.length > 0) {
        console.log(`   ✓ Updated ${result.length} members for group "${group.name}"`);
      }
    }

    // 4. Check for orphaned members (group_name doesn't match any group)
    console.log('\n4. Checking for orphaned members...');
    const orphanedMembers = await sql`
      SELECT rp.id, rp.full_name, rp.group_name
      FROM registered_people rp
      LEFT JOIN groups g ON rp.group_name = g.name
      WHERE rp.group_id IS NULL
      AND rp.group_name IS NOT NULL
      AND g.id IS NULL
    `;

    if (orphanedMembers.length > 0) {
      console.log(`   ⚠️  Found ${orphanedMembers.length} orphaned members with invalid group names:`);
      orphanedMembers.forEach(m => {
        console.log(`      - ${m.full_name} (group_name: "${m.group_name}")`);
      });
    } else {
      console.log('   ✓ No orphaned members found');
    }

    // 5. Final verification
    console.log('\n5. Final verification...');
    const finalStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(group_id) as with_group_id,
        COUNT(*) - COUNT(group_id) as without_group_id
      FROM registered_people
    `;
    
    console.log(`   Total members: ${finalStats[0].total}`);
    console.log(`   With group_id: ${finalStats[0].with_group_id}`);
    console.log(`   Without group_id: ${finalStats[0].without_group_id}`);

    // 6. Show members by group with stream info
    console.log('\n6. Members distribution by group and stream:');
    const distribution = await sql`
      SELECT 
        g.name as group_name,
        s.name as stream_name,
        COUNT(rp.id) as member_count
      FROM groups g
      LEFT JOIN streams s ON g.stream_id = s.id
      LEFT JOIN registered_people rp ON rp.group_id = g.id
      GROUP BY g.id, g.name, s.name
      ORDER BY s.name, g.name
    `;

    let currentStream = '';
    distribution.forEach(d => {
      if (d.stream_name !== currentStream) {
        currentStream = d.stream_name || 'No Stream';
        console.log(`\n   ${currentStream}:`);
      }
      console.log(`      - ${d.group_name}: ${d.member_count} members`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify the member distribution above is correct');
    console.log('2. If there are orphaned members, create groups for them or reassign to existing groups');
    console.log('3. Consider deprecating the group_name column in favor of group_id');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrateMembersToGroups()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
