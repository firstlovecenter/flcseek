-- Add archived column to groups table
-- This allows marking groups as archived without deleting them

ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Create an index on archived for faster filtering
CREATE INDEX IF NOT EXISTS idx_groups_archived ON groups(archived);

-- Create a composite index for year + archived filtering
CREATE INDEX IF NOT EXISTS idx_groups_year_archived ON groups(year, archived);

-- Add comment to document the column
COMMENT ON COLUMN groups.archived IS 'Whether this group has been archived (not currently active)';

-- Verify the changes
SELECT 'Migration 011 completed successfully - archived column added to groups table' AS status;
