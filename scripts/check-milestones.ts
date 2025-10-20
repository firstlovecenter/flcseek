import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ No database connection string found!');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function checkMilestones() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking milestones in database...\n');
    
    const result = await client.query(`
      SELECT 
        id,
        stage_number,
        stage_name,
        description,
        created_at
      FROM progress_stages
      ORDER BY stage_number ASC
    `);

    console.log(`Found ${result.rows.length} milestones:\n`);
    
    if (result.rows.length === 0) {
      console.log('⚠️  No milestones found in database!');
      console.log('Run: npx tsx scripts/migrate-progress-stages.ts');
    } else {
      result.rows.forEach((m: any) => {
        console.log(`${m.stage_number}. ${m.stage_name}`);
        if (m.description) {
          console.log(`   Description: ${m.description.substring(0, 60)}...`);
        }
        console.log('');
      });
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

checkMilestones();
