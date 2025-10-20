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

const MILESTONE_SHORT_NAMES = [
  { number: 1, shortName: 'Registered' },
  { number: 2, shortName: 'First Visit' },
  { number: 3, shortName: 'Second Visit' },
  { number: 4, shortName: 'Third Visit' },
  { number: 5, shortName: 'NB School' },
  { number: 6, shortName: 'Water Baptism' },
  { number: 7, shortName: 'HG Baptism' },
  { number: 8, shortName: 'SW School' },
  { number: 9, shortName: 'Friend Invited' },
  { number: 10, shortName: 'Joined Basonta' },
  { number: 11, shortName: 'LP Intro' },
  { number: 12, shortName: 'Mother Intro' },
  { number: 13, shortName: 'All Night' },
  { number: 14, shortName: 'Meeting God' },
  { number: 15, shortName: 'Federal Event' },
  { number: 16, shortName: 'Seeing & Hearing' },
  { number: 17, shortName: 'Interceded 3+Hrs' },
  { number: 18, shortName: 'Attendance' }
];

async function addMilestoneShortNames() {
  console.log('Starting migration: Adding short names to milestones...\n');

  try {
    // 1. Check if progress_stages table exists
    console.log('1. Checking if progress_stages table exists...');
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'progress_stages'
      ) as exists
    `;

    if (!tableCheck[0].exists) {
      console.log('   ⚠️  progress_stages table does not exist. Creating it...');
      
      await sql`
        CREATE TABLE IF NOT EXISTS progress_stages (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          stage_number integer UNIQUE NOT NULL,
          stage_name text NOT NULL,
          description text,
          short_name text,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )
      `;
      console.log('   ✓ Created progress_stages table');
    } else {
      console.log('   ✓ progress_stages table exists');
    }

    // 2. Check if short_name column exists
    console.log('\n2. Checking if short_name column exists...');
    const columnCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'progress_stages' 
        AND column_name = 'short_name'
      ) as exists
    `;

    if (!columnCheck[0].exists) {
      console.log('   Adding short_name column...');
      await sql`ALTER TABLE progress_stages ADD COLUMN short_name text`;
      console.log('   ✓ Added short_name column');
    } else {
      console.log('   ✓ short_name column already exists');
    }

    // 3. Check current milestones
    console.log('\n3. Checking current milestones in progress_stages...');
    const existingMilestones = await sql`
      SELECT stage_number, stage_name, short_name 
      FROM progress_stages 
      ORDER BY stage_number
    `;
    console.log(`   Found ${existingMilestones.length} existing milestones`);

    // 4. Insert or update milestones with short names
    console.log('\n4. Updating milestones with short names...');
    
    for (const milestone of MILESTONE_SHORT_NAMES) {
      const existing = existingMilestones.find(m => m.stage_number === milestone.number);
      
      if (existing) {
        // Update short_name
        await sql`
          UPDATE progress_stages 
          SET short_name = ${milestone.shortName},
              updated_at = NOW()
          WHERE stage_number = ${milestone.number}
        `;
        console.log(`   ✓ Updated M${milestone.number}: "${milestone.shortName}"`);
      } else {
        console.log(`   ⚠️  Milestone ${milestone.number} not found in progress_stages`);
      }
    }

    // 5. Final verification
    console.log('\n5. Final verification...');
    const finalMilestones = await sql`
      SELECT stage_number, stage_name, short_name 
      FROM progress_stages 
      ORDER BY stage_number
    `;

    console.log('\n   Milestone Short Names:');
    finalMilestones.forEach(m => {
      const label = `M${m.stage_number}`.padEnd(4);
      const shortName = (m.short_name || 'NOT SET').padEnd(20);
      console.log(`   ${label} ${shortName} - ${m.stage_name}`);
    });

    const milestonesWithoutShortName = finalMilestones.filter(m => !m.short_name);
    if (milestonesWithoutShortName.length > 0) {
      console.log(`\n   ⚠️  ${milestonesWithoutShortName.length} milestones still missing short names`);
    } else {
      console.log('\n   ✓ All milestones have short names');
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

addMilestoneShortNames()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
