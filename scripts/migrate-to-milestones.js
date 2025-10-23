#!/usr/bin/env node

/**
 * Migration Script: Rename progress_stages to milestones
 * 
 * This script renames the progress_stages table to milestones
 * and adds the short_name column with default values.
 * 
 * Usage: node scripts/migrate-to-milestones.js
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL or NEON_DATABASE_URL not found in environment variables');
  process.exit(1);
}

async function runMigration() {
  const sql = neon(connectionString);
  
  console.log('🚀 Starting migration: progress_stages → milestones\n');
  
  try {
    // Step 1: Check if table needs to be renamed
    console.log('📋 Step 1: Checking current table name...');
    const tableCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('progress_stages', 'milestones')
    `;
    
    const hasProgressStages = tableCheck.some(t => t.table_name === 'progress_stages');
    const hasMilestones = tableCheck.some(t => t.table_name === 'milestones');
    
    if (hasMilestones && !hasProgressStages) {
      console.log('✅ Table already renamed to milestones. Skipping rename step.\n');
    } else if (hasProgressStages) {
      console.log('🔄 Renaming progress_stages to milestones...');
      await sql`ALTER TABLE progress_stages RENAME TO milestones`;
      console.log('✅ Table renamed successfully\n');
    } else {
      console.error('❌ Error: Neither progress_stages nor milestones table found!');
      process.exit(1);
    }
    
    // Step 2: Add short_name column if it doesn't exist
    console.log('📋 Step 2: Checking for short_name column...');
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'milestones' AND column_name = 'short_name'
    `;
    
    if (columnCheck.length === 0) {
      console.log('🔄 Adding short_name column...');
      await sql`ALTER TABLE milestones ADD COLUMN short_name text`;
      console.log('✅ Column added successfully\n');
    } else {
      console.log('✅ short_name column already exists\n');
    }
    
    // Step 3: Rename index if it exists
    console.log('📋 Step 3: Renaming index...');
    try {
      await sql`ALTER INDEX IF EXISTS idx_progress_stages_number RENAME TO idx_milestones_number`;
      console.log('✅ Index renamed successfully\n');
    } catch (error) {
      console.log('ℹ️  Index already renamed or doesn\'t exist\n');
    }
    
    // Step 4: Update trigger
    console.log('📋 Step 4: Updating trigger...');
    await sql`DROP TRIGGER IF EXISTS update_progress_stages_updated_at ON milestones`;
    await sql`
      CREATE OR REPLACE TRIGGER update_milestones_updated_at 
        BEFORE UPDATE ON milestones 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column()
    `;
    console.log('✅ Trigger updated successfully\n');
    
    // Step 5: Update short_names for existing records
    console.log('📋 Step 5: Updating short_names for existing milestones...');
    const updates = [
      [1, 'NB\\nSchool'],
      [2, 'SW\\nSchool'],
      [3, 'First\\nVisit'],
      [4, 'Second\\nVisit'],
      [5, 'Third\\nVisit'],
      [6, 'Water\\nBaptism'],
      [7, 'HG\\nBaptism'],
      [8, 'Joined\\nBasonta'],
      [9, 'Seeing &\\nHearing'],
      [10, 'LP\\nIntro'],
      [11, 'Mother\\nIntro'],
      [12, 'Church\\nSocial'],
      [13, 'All\\nNight'],
      [14, 'Meeting\\nGod'],
      [15, 'Friend\\nInvited'],
      [16, 'Ministry\\nTraining'],
      [17, 'Cell\\nGroup'],
      [18, 'First Year'],
    ];
    
    let updatedCount = 0;
    for (const [stage_number, short_name] of updates) {
      const result = await sql`
        UPDATE milestones 
        SET short_name = ${short_name} 
        WHERE stage_number = ${stage_number} AND short_name IS NULL
      `;
      if (result.length > 0 || result.rowCount > 0) {
        updatedCount++;
      }
    }
    console.log(`✅ Updated ${updatedCount} milestone short_names\n`);
    
    // Step 6: Verify migration
    console.log('📋 Step 6: Verifying migration...');
    const milestones = await sql`SELECT COUNT(*) as count FROM milestones`;
    const withShortNames = await sql`SELECT COUNT(*) as count FROM milestones WHERE short_name IS NOT NULL`;
    
    console.log(`✅ Total milestones: ${milestones[0].count}`);
    console.log(`✅ Milestones with short_names: ${withShortNames[0].count}`);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - Table renamed: progress_stages → milestones');
    console.log('   - Column added: short_name');
    console.log('   - Index renamed: idx_progress_stages_number → idx_milestones_number');
    console.log('   - Trigger updated: update_milestones_updated_at');
    console.log(`   - Records updated: ${withShortNames[0].count}/${milestones[0].count}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
