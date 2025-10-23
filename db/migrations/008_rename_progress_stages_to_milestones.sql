-- Rename progress_stages table to milestones
ALTER TABLE progress_stages RENAME TO milestones;

-- Rename the index
ALTER INDEX idx_progress_stages_number RENAME TO idx_milestones_number;

-- Drop the old trigger
DROP TRIGGER IF EXISTS update_progress_stages_updated_at ON milestones;

-- Recreate the trigger with the new name
CREATE TRIGGER update_milestones_updated_at 
  BEFORE UPDATE ON milestones 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Verify the table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'milestones') THEN
    RAISE EXCEPTION 'Migration failed: milestones table does not exist';
  END IF;
  
  RAISE NOTICE 'Successfully renamed progress_stages to milestones';
END $$;
