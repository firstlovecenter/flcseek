-- =============================================================================
-- Add Overseer Role Support
-- Purpose: Add 'overseer' as a valid role for users
-- =============================================================================

-- Drop the existing check constraint on the role column
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new check constraint that includes 'overseer'
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('superadmin', 'leadpastor', 'overseer', 'admin', 'leader'));

-- Add is_active column to milestones if not exists
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create index for active milestones
CREATE INDEX IF NOT EXISTS idx_milestones_is_active ON milestones(is_active);
