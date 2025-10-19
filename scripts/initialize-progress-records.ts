import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const sql = neon(process.env.NEON_DATABASE_URL!);

const PROGRESS_STAGES = [
  { number: 1, name: 'Completed New Believers School' },
  { number: 2, name: 'Completed Soul-Winning School' },
  { number: 3, name: 'Visited (First Quarter)' },
  { number: 4, name: 'Visited (Second Quarter)' },
  { number: 5, name: 'Visited (Third Quarter)' },
  { number: 6, name: 'Baptised in Water' },
  { number: 7, name: 'Baptised in the Holy Ghost' },
  { number: 8, name: 'Joined Basonta or Creative Arts' },
  { number: 9, name: 'Completed Seeing & Hearing Education' },
  { number: 10, name: 'Introduced to Lead Pastor' },
  { number: 11, name: 'Introduced to a First Love Mother' },
  { number: 12, name: 'Attended Church Social Outing' },
  { number: 13, name: 'Attended All-Night Prayer' },
  { number: 14, name: 'Attended "Meeting God"' },
  { number: 15, name: 'Invited a Friend to Church' }
];

async function initializeProgressRecords() {
  console.log('\n🔧 Initializing Missing Progress Records...\n');

  // Get a super admin user to use as updated_by
  const adminResult = await sql`SELECT id FROM users WHERE role = 'super_admin' LIMIT 1`;
  if (adminResult.length === 0) {
    console.error('❌ No super admin user found. Please create a super admin first.');
    process.exit(1);
  }
  const adminId = adminResult[0].id;
  console.log(`Using admin ID: ${adminId}`);

  // Get all people
  const peopleResult = await sql`SELECT id, full_name FROM registered_people`;
  console.log(`Found ${peopleResult.length} total people\n`);

  let initializedCount = 0;
  let skippedCount = 0;

  for (const person of peopleResult) {
    // Check if this person already has progress records
    const existingRecords = await sql`
      SELECT COUNT(*) as count 
      FROM progress_records 
      WHERE person_id = ${person.id}
    `;
    
    const recordCount = existingRecords[0].count;

    if (recordCount === 0) {
      // Initialize all 15 stages for this person
      console.log(`  ⚙️  Initializing records for: ${person.full_name}`);
      
      for (const stage of PROGRESS_STAGES) {
        await sql`
          INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, updated_by)
          VALUES (${person.id}, ${stage.number}, ${stage.name}, false, ${adminId})
        `;
      }
      
      initializedCount++;
    } else if (recordCount < 15) {
      // Person has some but not all records - add missing ones
      console.log(`  ⚠️  ${person.full_name} has ${recordCount}/15 records, adding missing stages...`);
      
      for (const stage of PROGRESS_STAGES) {
        const existing = await sql`
          SELECT id FROM progress_records 
          WHERE person_id = ${person.id} AND stage_number = ${stage.number}
        `;
        
        if (existing.length === 0) {
          await sql`
            INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, updated_by)
            VALUES (${person.id}, ${stage.number}, ${stage.name}, false, ${adminId})
          `;
        }
      }
      
      initializedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`\n✅ Progress Records Initialization Complete!`);
  console.log(`  - ${initializedCount} people had records initialized`);
  console.log(`  - ${skippedCount} people already had all 15 records`);
  console.log(`  - Total people: ${peopleResult.length}\n`);
}

initializeProgressRecords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
