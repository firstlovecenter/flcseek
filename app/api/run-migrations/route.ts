import { NextResponse } from 'next/server';
import { query } from '@/lib/neon';

export async function POST() {
  try {
    console.log('Running database migrations...');

    // Migration 002: Add location fields
    console.log('Running migration 002: Add location fields...');
    await query(`
      ALTER TABLE registered_people 
      ADD COLUMN IF NOT EXISTS home_location text,
      ADD COLUMN IF NOT EXISTS work_location text
    `);
    console.log('✅ Migration 002 completed');

    // Migration 003: Add user name and email fields
    console.log('Running migration 003: Add user name and email fields...');
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS first_name text,
      ADD COLUMN IF NOT EXISTS last_name text,
      ADD COLUMN IF NOT EXISTS email text
    `);

    // Make role nullable
    await query(`
      ALTER TABLE users ALTER COLUMN role DROP NOT NULL
    `);

    // Add unique constraint on email
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users(email) WHERE email IS NOT NULL
    `);

    // Drop department_name column if it exists
    await query(`
      ALTER TABLE users DROP COLUMN IF EXISTS department_name
    `);

    console.log('✅ Migration 003 completed');

    // Migration 004: Rename departments to groups
    console.log('Running migration 004: Rename departments to groups...');
    
    // Rename departments table to groups
    await query(`
      ALTER TABLE IF EXISTS departments RENAME TO groups
    `);

    // Rename department_name to group_name in registered_people
    await query(`
      ALTER TABLE registered_people 
      RENAME COLUMN department_name TO group_name
    `);

    // Rename indexes
    await query(`
      DROP INDEX IF EXISTS idx_registered_people_department
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_registered_people_group ON registered_people(group_name)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_groups_leader ON groups(leader_id)
    `);

    console.log('✅ Migration 004 completed');

    // Verify columns
    const checkPeopleColumns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'registered_people' 
      AND column_name IN ('home_location', 'work_location')
    `);

    const checkUserColumns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('first_name', 'last_name', 'email')
    `);

    const checkGroupsTable = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'groups'
    `);

    const checkGroupNameColumn = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'registered_people' 
      AND column_name = 'group_name'
    `);

    // Migration 010: Add unique constraint on phone_number
    console.log('Running migration 010: Add unique constraint on phone_number...');
    await query(`
      ALTER TABLE registered_people 
      ADD CONSTRAINT IF NOT EXISTS unique_phone_number UNIQUE (phone_number)
    `);
    console.log('✅ Migration 010 completed');

    return NextResponse.json({
      success: true,
      message: 'All migrations completed successfully',
      migrations: {
        '002_location_fields': checkPeopleColumns.rows,
        '003_user_name_email': checkUserColumns.rows,
        '004_rename_to_groups': {
          groups_table_exists: checkGroupsTable.rows.length > 0,
          group_name_column_exists: checkGroupNameColumn.rows.length > 0
        },
        '010_unique_phone_constraint': 'Added unique constraint on phone_number'
      }
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to run migrations'
    }, { status: 500 });
  }
}
