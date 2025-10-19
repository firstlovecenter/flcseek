import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function checkProgress() {
  console.log('\n🔍 Checking Progress Records...\n');

  // Check if progress_records table has data
  const peopleResult = await sql`SELECT id, full_name FROM registered_people LIMIT 5`;
  console.log(`Found ${peopleResult.length} people (showing first 5)`);

  for (const person of peopleResult) {
    const progressResult = await sql`
      SELECT COUNT(*) as count 
      FROM progress_records 
      WHERE person_id = ${person.id}
    `;
    const count = progressResult[0].count;
    console.log(`  - ${person.full_name}: ${count} progress records`);
  }

  // Get detailed progress for first person
  if (peopleResult.length > 0) {
    const firstPerson = peopleResult[0];
    console.log(`\n📋 Detailed progress for ${firstPerson.full_name}:`);
    const detailedProgress = await sql`
      SELECT stage_number, is_completed 
      FROM progress_records 
      WHERE person_id = ${firstPerson.id}
      ORDER BY stage_number ASC
    `;
    
    if (detailedProgress.length === 0) {
      console.log('  ❌ NO PROGRESS RECORDS FOUND!');
    } else {
      detailedProgress.forEach((stage:any) => {
        console.log(`  Stage ${stage.stage_number}: ${stage.is_completed ? '✅ Completed' : '⬜ Not completed'}`);
      });
    }
  }
}

checkProgress()
  .then(() => {
    console.log('\n✅ Check complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
