/**
 * Script to add is_active column to milestones table
 * Run with: npm run tsx scripts/add-is-active-to-milestones.ts
 */

import { config } from 'dotenv';
import { query } from '../lib/neon';

// Load environment variables
config();

async function runMigration() {
  try {
    console.log('Adding is_active column to milestones table...');
    
    // Add is_active column
    await query(`
      ALTER TABLE milestones 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
    `);
    console.log('✅ Added is_active column');

    // Set all existing milestones to active
    const updateResult = await query(`
      UPDATE milestones 
      SET is_active = true 
      WHERE is_active IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount} milestones to active`);

    // Add index
    await query(`
      CREATE INDEX IF NOT EXISTS idx_milestones_is_active 
      ON milestones(is_active)
    `);
    console.log('✅ Created index on is_active column');

    // Verify the migration
    const result = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'milestones' AND column_name = 'is_active'
    `);
    
    if (result.rows.length > 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('Column details:', result.rows[0]);
    } else {
      console.error('❌ Migration verification failed');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
