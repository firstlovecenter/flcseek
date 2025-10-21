import 'dotenv/config';
import { query } from '../lib/neon';

async function checkGroupData() {
  try {
    console.log('🔍 Checking group data...\n');

    // Check groups
    const groupsResult = await query(
      `SELECT id, name, 
       (SELECT COUNT(*) FROM registered_people WHERE group_id = groups.id) as people_count
       FROM groups 
       ORDER BY name`
    );

    console.log('📋 Groups and their registered people count:');
    console.log('═'.repeat(80));
    groupsResult.rows.forEach(group => {
      console.log(`${group.name.padEnd(20)} - ${group.people_count} people`);
    });

    // Check registered_people without group assignment
    const unassignedResult = await query(
      `SELECT COUNT(*) as count FROM registered_people WHERE group_id IS NULL`
    );
    
    console.log('\n⚠️  Unassigned people (no group_id):', unassignedResult.rows[0].count);

    // Check registered_people with group_name but no group_id
    const nameOnlyResult = await query(
      `SELECT group_name, COUNT(*) as count 
       FROM registered_people 
       WHERE group_id IS NULL AND group_name IS NOT NULL
       GROUP BY group_name
       ORDER BY group_name`
    );

    if (nameOnlyResult.rows.length > 0) {
      console.log('\n📊 People with group_name but no group_id:');
      console.log('═'.repeat(80));
      nameOnlyResult.rows.forEach(row => {
        console.log(`${row.group_name.padEnd(20)} - ${row.count} people`);
      });
    }

    // Total registered people
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM registered_people`
    );
    console.log('\n📈 Total registered people in database:', totalResult.rows[0].total);

    // Check january specifically
    console.log('\n🔍 Checking January group specifically:');
    const januaryResult = await query(
      `SELECT id, name FROM groups WHERE name ILIKE '%january%'`
    );
    
    if (januaryResult.rows.length > 0) {
      const januaryGroup = januaryResult.rows[0];
      console.log(`  Group: ${januaryGroup.name}`);
      console.log(`  ID: ${januaryGroup.id}`);
      
      const januaryPeopleResult = await query(
        `SELECT COUNT(*) as count FROM registered_people WHERE group_id = $1`,
        [januaryGroup.id]
      );
      console.log(`  People assigned: ${januaryPeopleResult.rows[0].count}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkGroupData()
  .then(() => {
    console.log('\n✅ Check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
