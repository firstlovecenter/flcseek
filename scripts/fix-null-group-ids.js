// Fix NULL group_ids by looking up from group_name
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.NEON_DATABASE_URL);

async function fixNullGroupIds() {
  console.log('🔧 Fixing NULL group_ids...\n');

  try {
    // Find all people with NULL group_id but have group_name
    const peopleWithNullGroupId = await sql`
      SELECT id, first_name, last_name, group_name
      FROM new_converts
      WHERE group_id IS NULL AND group_name IS NOT NULL
    `;

    console.log(`Found ${peopleWithNullGroupId.length} people with NULL group_id\n`);

    if (peopleWithNullGroupId.length === 0) {
      console.log('✓ No fixes needed!');
      return;
    }

    let fixed = 0;
    let failed = 0;

    for (const person of peopleWithNullGroupId) {
      try {
        // Look up the group_id from the group_name
        const groupResult = await sql`
          SELECT id FROM groups WHERE name = ${person.group_name}
        `;

        if (groupResult.length > 0) {
          const groupId = groupResult[0].id;

          // Update the person's group_id
          await sql`
            UPDATE new_converts
            SET group_id = ${groupId}
            WHERE id = ${person.id}
          `;

          console.log(`✓ Fixed: ${person.first_name} ${person.last_name} (${person.group_name}) - group_id set to ${groupId}`);
          fixed++;
        } else {
          console.log(`⚠️  Skipped: ${person.first_name} ${person.last_name} - Group "${person.group_name}" not found in database`);
          failed++;
        }
      } catch (error) {
        console.error(`❌ Error fixing ${person.first_name} ${person.last_name}:`, error.message);
        failed++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${peopleWithNullGroupId.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixNullGroupIds().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
