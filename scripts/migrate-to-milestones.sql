-- Migration Script: Rename progress_stages to milestones
-- Run this script on your existing database to update the table name

-- Step 1: Rename the table
ALTER TABLE IF EXISTS progress_stages RENAME TO milestones;

-- Step 2: Add short_name column if it doesn't exist
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS short_name text;

-- Step 3: Rename the index
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_progress_stages_number') THEN
    ALTER INDEX idx_progress_stages_number RENAME TO idx_milestones_number;
  END IF;
END $$;

-- Step 4: Drop the old trigger if it exists
DROP TRIGGER IF EXISTS update_progress_stages_updated_at ON milestones;

-- Step 5: Create the new trigger
CREATE OR REPLACE TRIGGER update_milestones_updated_at 
  BEFORE UPDATE ON milestones 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Update existing records with short_names
UPDATE milestones SET short_name = 'NB\nSchool' WHERE stage_number = 1 AND short_name IS NULL;
UPDATE milestones SET short_name = 'SW\nSchool' WHERE stage_number = 2 AND short_name IS NULL;
UPDATE milestones SET short_name = 'First\nVisit' WHERE stage_number = 3 AND short_name IS NULL;
UPDATE milestones SET short_name = 'Second\nVisit' WHERE stage_number = 4 AND short_name IS NULL;
UPDATE milestones SET short_name = 'Third\nVisit' WHERE stage_number = 5 AND short_name IS NULL;
UPDATE milestones SET short_name = 'Water\nBaptism' WHERE stage_number = 6 AND short_name IS NULL;
UPDATE milestones SET short_name = 'HG\nBaptism' WHERE stage_number = 7 AND short_name IS NULL;
UPDATE milestones SET short_name = 'Joined\nBasonta' WHERE stage_number = 8 AND short_name IS NULL;
UPDATE milestones SET short_name = 'Seeing &\nHearing' WHERE stage_number = 9 AND short_name IS NULL;
UPDATE milestones SET short_name = 'LP\nIntro' WHERE stage_number = 10 AND short_name IS NULL;
UPDATE milestones SET short_name = 'Mother\nIntro' WHERE stage_number = 11 AND short_name IS NULL;
UPDATE milestones SET short_name = 'Church\nSocial' WHERE stage_number = 12 AND short_name IS NULL;
UPDATE milestones SET short_name = 'All\nNight' WHERE stage_number = 13 AND short_name IS NULL;
UPDATE milestones SET short_name = 'Meeting\nGod' WHERE stage_number = 14 AND short_name IS NULL;
UPDATE milestones SET short_name = 'Friend\nInvited' WHERE stage_number = 15 AND short_name IS NULL;
UPDATE milestones SET short_name = 'Ministry\nTraining' WHERE stage_number = 16 AND short_name IS NULL;
UPDATE milestones SET short_name = 'Cell\nGroup' WHERE stage_number = 17 AND short_name IS NULL;
UPDATE milestones SET short_name = 'First Year' WHERE stage_number = 18 AND short_name IS NULL;

-- Step 7: Verify the migration
DO $$
DECLARE
  table_exists boolean;
  column_exists boolean;
  record_count integer;
BEGIN
  -- Check if milestones table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'milestones'
  ) INTO table_exists;
  
  -- Check if short_name column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'milestones' AND column_name = 'short_name'
  ) INTO column_exists;
  
  -- Get record count
  SELECT COUNT(*) INTO record_count FROM milestones;
  
  -- Report results
  IF table_exists THEN
    RAISE NOTICE 'SUCCESS: milestones table exists';
  ELSE
    RAISE EXCEPTION 'FAILED: milestones table does not exist';
  END IF;
  
  IF column_exists THEN
    RAISE NOTICE 'SUCCESS: short_name column exists';
  ELSE
    RAISE EXCEPTION 'FAILED: short_name column does not exist';
  END IF;
  
  RAISE NOTICE 'Total milestones: %', record_count;
  RAISE NOTICE 'Migration completed successfully!';
END $$;
