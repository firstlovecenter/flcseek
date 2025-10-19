-- Migration 004: Rename departments to groups
-- This migration renames all department-related tables, columns, and constraints

-- Step 1: Rename the departments table to groups
ALTER TABLE IF EXISTS departments RENAME TO groups;

-- Step 2: Rename the leader_id column to group_leader_id for clarity (optional, keeping as leader_id)
-- We'll keep leader_id as is since it's clear in context

-- Step 3: Update registered_people table - rename department_name to group_name
ALTER TABLE registered_people 
RENAME COLUMN department_name TO group_name;

-- Step 4: Rename indexes
-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_registered_people_department;

-- Create new indexes with updated names
CREATE INDEX IF NOT EXISTS idx_registered_people_group ON registered_people(group_name);
CREATE INDEX IF NOT EXISTS idx_groups_leader ON groups(leader_id);

-- Step 5: Add comments
COMMENT ON TABLE groups IS 'Groups (formerly departments) for organizing registered people and assigning sheep seekers';
COMMENT ON COLUMN registered_people.group_name IS 'Name of the group this person belongs to';
COMMENT ON COLUMN groups.leader_id IS 'User ID of the group leader (sheep seeker)';

-- Verify the changes
SELECT 'Migration 004 completed successfully' AS status;
