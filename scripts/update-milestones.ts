import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ No database connection string found!');
  process.exit(1);
}

const pool = new Pool({ connectionString });

const newMilestones = [
  { number: 1, name: 'Registered as Church Member', description: 'Has registered as a church member.' },
  { number: 2, name: 'Visited (First Quarter)', description: 'Has been visited within the first quarter of the sheep seeking year.' },
  { number: 3, name: 'Visited (Second Quarter)', description: 'Has been visited within the second quarter of the sheep seeking year.' },
  { number: 4, name: 'Visited (Third Quarter)', description: 'Has been visited within the third quarter of the sheep seeking year.' },
  { number: 5, name: 'Completed New Believers School', description: 'Has completed new believers school.' },
  { number: 6, name: 'Baptized in Water', description: 'Has been baptized in water.' },
  { number: 7, name: 'Baptized in the Holy Ghost', description: 'Has been baptized in the Holy Ghost.' },
  { number: 8, name: 'Completed Soul-Winning School', description: 'Has completed Soul-Winning School.' },
  { number: 9, name: 'Invited Friend to Church', description: 'Has invited at least one friend to church.' },
  { number: 10, name: 'Joined Basonta or Creative Arts', description: 'Has been planted in a Basonta or a Creative Arts ministry.' },
  { number: 11, name: 'Introduced to Lead Pastor', description: 'Has been introduced to the Lead Pastor.' },
  { number: 12, name: 'Introduced to First Love Mother', description: 'Has been introduced to a First Love Mother.' },
  { number: 13, name: 'Attended All-Night Prayer', description: 'Has attended an all-night prayer meeting at the centre at least once.' },
  { number: 14, name: 'Attended Meeting God', description: 'Has attended Meeting God service at least once.' },
  { number: 15, name: 'Attended Federal Event', description: 'Has attended a Federal Outreach, Conference, or Camp Meeting at least once.' },
  { number: 16, name: 'Completed Seeing & Hearing Education', description: 'Has been taken through Seeing and Hearing education.' },
  { number: 17, name: 'Interceded For (3+ Hours)', description: 'Has been interceded for by a sheep-seeker for at least three hours.' },
  { number: 18, name: 'Attended 12 Sunday Services', description: 'Has attended Sunday church service twelve times.' },
];

async function updateMilestones() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Updating milestones in database...\n');

    for (const milestone of newMilestones) {
      console.log(`Updating ${milestone.number}. ${milestone.name}...`);
      
      await client.query(`
        UPDATE progress_stages
        SET 
          stage_name = $1,
          description = $2,
          updated_at = NOW()
        WHERE stage_number = $3
      `, [milestone.name, milestone.description, milestone.number]);
      
      console.log('✅ Updated\n');
    }

    // Verify the updates
    console.log('Verifying updates...\n');
    const result = await client.query(`
      SELECT stage_number, stage_name, description 
      FROM progress_stages 
      ORDER BY stage_number
    `);

    console.log('✅ All milestones updated successfully!\n');
    console.log('Current milestones:\n');
    result.rows.forEach((m: any) => {
      console.log(`${m.stage_number}. ${m.stage_name}`);
      console.log(`   ${m.description}\n`);
    });

    console.log('🎉 Update complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Update failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

updateMilestones();
