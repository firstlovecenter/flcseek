-- Migration 003b: Create groups table (fixed version that directly creates groups instead of departments)
-- This replaces migration 003 which was never run

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  leader_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Update registered_people table - rename department_name to group_name
ALTER TABLE registered_people 
RENAME COLUMN department_name TO group_name;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_groups_leader_id ON groups(leader_id);
CREATE INDEX IF NOT EXISTS idx_registered_people_group ON registered_people(group_name);

-- Add comments for documentation
COMMENT ON TABLE groups IS 'Church groups (formerly departments) with assigned leaders';
COMMENT ON COLUMN groups.name IS 'Group name (must be unique)';
COMMENT ON COLUMN groups.description IS 'Group description/purpose';
COMMENT ON COLUMN groups.leader_id IS 'User ID of the group leader (sheep_seeker)';
COMMENT ON COLUMN registered_people.group_name IS 'Name of the group this person belongs to';

-- Verify the changes
SELECT 'Migration 003b completed successfully - groups table created and columns renamed' AS status;
