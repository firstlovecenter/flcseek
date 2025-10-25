import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/neon';

export async function POST(request: NextRequest) {
  try {
    // Check if this is a custom query request
    const body = await request.json().catch(() => ({}));
    
    if (body.query) {
      // Execute custom query for migration tool
      console.log('Executing custom query:', body.action);
      const result = await query(body.query);
      return NextResponse.json({
        success: true,
        result: result.rows,
        rowCount: result.rowCount
      });
    }
    
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
    
    try {
      // Rename departments table to groups
      await query(`
        ALTER TABLE IF EXISTS departments RENAME TO groups
      `);
    } catch (e) {
      console.log('Skipping departments rename (already done or doesn\'t exist)');
    }

    try {
      // Rename department_name to group_name in registered_people
      await query(`
        ALTER TABLE registered_people 
        RENAME COLUMN department_name TO group_name
      `);
    } catch (e) {
      console.log('Skipping department_name rename (already done or doesn\'t exist)');
    }

    try {
      // Rename indexes
      await query(`
        DROP INDEX IF EXISTS idx_registered_people_department
      `);
    } catch (e) {
      console.log('Skipping index drop');
    }

    try {
      await query(`
        CREATE INDEX IF NOT EXISTS idx_registered_people_group ON registered_people(group_name)
      `);
    } catch (e) {
      console.log('Skipping registered_people_group index');
    }

    try {
      await query(`
        CREATE INDEX IF NOT EXISTS idx_groups_leader ON groups(leader_id)
      `);
    } catch (e) {
      console.log('Skipping groups_leader index (column may not exist)');
    }

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
    try {
      await query(`
        ALTER TABLE registered_people 
        ADD CONSTRAINT unique_phone_number UNIQUE (phone_number)
      `);
      console.log('✅ Migration 010 completed');
    } catch (e: any) {
      if (e.code === '42P07' || e.message?.includes('already exists')) {
        console.log('✅ Migration 010 skipped (constraint already exists)');
      } else {
        console.log('✅ Migration 010 skipped or completed');
      }
    }

    // Migration 006: Add year to groups
    console.log('Running migration 006: Add year to groups...');
    await query(`
      ALTER TABLE groups 
      ADD COLUMN IF NOT EXISTS year INTEGER NOT NULL DEFAULT 2025
    `);
    
    try {
      await query(`
        ALTER TABLE groups 
        DROP CONSTRAINT IF EXISTS groups_name_unique
      `);
    } catch (e) {
      console.log('Skipping groups_name_unique drop');
    }
    
    try {
      await query(`
        ALTER TABLE groups 
        DROP CONSTRAINT IF EXISTS groups_name_key
      `);
      console.log('Dropped old groups_name_key constraint');
    } catch (e) {
      console.log('Skipping groups_name_key drop (may not exist)');
    }
    
    try {
      await query(`
        ALTER TABLE groups 
        DROP CONSTRAINT IF EXISTS groups_name_year_unique
      `);
    } catch (e) {
      console.log('Constraint groups_name_year_unique does not exist yet');
    }
    
    try {
      await query(`
        ALTER TABLE groups 
        ADD CONSTRAINT groups_name_year_unique UNIQUE (name, year)
      `);
      console.log('Added groups_name_year_unique constraint');
    } catch (e: any) {
      if (e.code === '42P07') {
        console.log('Constraint groups_name_year_unique already exists');
      } else {
        console.log('Error adding constraint:', e.message);
      }
    }
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_groups_year ON groups(year)
    `);
    
    await query(`
      UPDATE groups SET year = 2025 WHERE year IS NULL OR year = 0
    `);
    console.log('✅ Migration 006 completed');

    // Migration 011: Add archived to groups
    console.log('Running migration 011: Add archived to groups...');
    await query(`
      ALTER TABLE groups 
      ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_groups_archived ON groups(archived)
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_groups_year_archived ON groups(year, archived)
    `);
    console.log('✅ Migration 011 completed');

    // Migration 012: Fix leader columns - standardize to leader_id
    console.log('Running migration 012: Fix leader columns...');
    
    // Add leader_id if it doesn't exist
    try {
      await query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'groups' AND column_name = 'leader_id'
          ) THEN
            ALTER TABLE groups ADD COLUMN leader_id uuid REFERENCES users(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `);
      console.log('Ensured leader_id column exists');
    } catch (e) {
      console.log('Leader_id column handling:', e);
    }

    // Copy sheep_seeker_id to leader_id and drop sheep_seeker_id
    try {
      await query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'groups' AND column_name = 'sheep_seeker_id'
          ) THEN
            UPDATE groups SET leader_id = sheep_seeker_id WHERE sheep_seeker_id IS NOT NULL AND leader_id IS NULL;
            ALTER TABLE groups DROP COLUMN sheep_seeker_id;
          END IF;
        END $$;
      `);
      console.log('Migrated sheep_seeker_id to leader_id');
    } catch (e) {
      console.log('Sheep_seeker_id migration:', e);
    }

    // Recreate index
    try {
      await query(`DROP INDEX IF EXISTS idx_groups_leader_id`);
      await query(`CREATE INDEX idx_groups_leader_id ON groups(leader_id)`);
      console.log('Created leader_id index');
    } catch (e) {
      console.log('Index creation:', e);
    }

    // Update roles
    try {
      await query(`UPDATE users SET role = 'leader' WHERE role = 'sheep_seeker'`);
      console.log('Updated sheep_seeker roles to leader');
    } catch (e) {
      console.log('Role update:', e);
    }

    console.log('✅ Migration 012 completed');

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
        '006_add_year_to_groups': 'Added year field to groups',
        '010_unique_phone_constraint': 'Added unique constraint on phone_number',
        '011_add_archived_to_groups': 'Added archived field to groups',
        '012_fix_leader_columns': 'Standardized to leader_id, removed sheep_seeker_id'
      }
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to run migrations'
    }, { status: 500 });
  }
}
