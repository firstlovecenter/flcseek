-- Add year column to groups table
-- This allows tracking groups across different years (e.g., January 2025, January 2026)

ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS year INTEGER NOT NULL DEFAULT 2025;

-- Add a unique constraint to prevent duplicate group_name + year combinations
ALTER TABLE groups 
DROP CONSTRAINT IF EXISTS groups_name_unique;

ALTER TABLE groups 
ADD CONSTRAINT groups_name_year_unique UNIQUE (name, year);

-- Create an index on year for faster filtering
CREATE INDEX IF NOT EXISTS idx_groups_year ON groups(year);

-- Update existing groups to have year 2025
UPDATE groups SET year = 2025 WHERE year IS NULL OR year = 0;

-- Add comment to document the column
COMMENT ON COLUMN groups.year IS 'The year this group is running (e.g., 2025, 2026)';
