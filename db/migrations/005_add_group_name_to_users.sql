-- Migration: Add group_name column to users table for group assignments
-- This allows super admin to assign sheep_seeker users to specific groups

-- Add group_name column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_group_name ON users(group_name);

-- Add foreign key comment
COMMENT ON COLUMN users.group_name IS 'Name of the group this user (sheep_seeker) is assigned to lead';

-- Verify the changes
SELECT 'Migration completed: group_name column added to users table' AS status;
