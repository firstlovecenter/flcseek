-- Migration 012: Fix leader columns - remove sheep_seeker_id, ensure leader_id exists
-- This migration standardizes the groups table to use leader_id consistently

-- Step 1: Add leader_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' AND column_name = 'leader_id'
  ) THEN
    ALTER TABLE groups ADD COLUMN leader_id uuid REFERENCES users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added leader_id column';
  END IF;
END $$;

-- Step 2: Copy data from sheep_seeker_id to leader_id if sheep_seeker_id exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' AND column_name = 'sheep_seeker_id'
  ) THEN
    -- Copy any existing sheep_seeker_id values to leader_id
    EXECUTE 'UPDATE groups SET leader_id = sheep_seeker_id WHERE sheep_seeker_id IS NOT NULL AND leader_id IS NULL';
    RAISE NOTICE 'Copied sheep_seeker_id to leader_id';
    
    -- Drop the sheep_seeker_id column
    ALTER TABLE groups DROP COLUMN sheep_seeker_id;
    RAISE NOTICE 'Dropped sheep_seeker_id column';
  END IF;
END $$;

-- Step 3: Recreate the index on leader_id
DROP INDEX IF EXISTS idx_groups_leader_id;
CREATE INDEX idx_groups_leader_id ON groups(leader_id);

-- Step 4: Update any 'sheep_seeker' role to 'leader' in users table
UPDATE users SET role = 'leader' WHERE role = 'sheep_seeker';

COMMENT ON COLUMN groups.leader_id IS 'User ID of the group leader';

SELECT 'Migration 012 completed - leader columns standardized' AS status;
