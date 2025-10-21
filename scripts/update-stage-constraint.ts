import { Pool } from '@neondatabase/serverless';

async function updateStageConstraint() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  
  try {
    console.log('Updating stage_number constraint to allow 1-18...\n');
    
    // Drop old constraint
    await pool.query(`
      ALTER TABLE progress_records 
      DROP CONSTRAINT IF EXISTS progress_records_stage_number_check;
    `);
    console.log('✅ Dropped old constraint\n');
    
    // Add new constraint for 1-18
    await pool.query(`
      ALTER TABLE progress_records 
      ADD CONSTRAINT progress_records_stage_number_check 
      CHECK (stage_number >= 1 AND stage_number <= 18);
    `);
    console.log('✅ Added new constraint (stage_number 1-18)\n');
    
    console.log('🎉 Constraint updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating constraint:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

updateStageConstraint();
