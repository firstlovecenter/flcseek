-- Add location fields to registered_people table
-- Migration: Add home_location and work_location columns

ALTER TABLE registered_people 
ADD COLUMN IF NOT EXISTS home_location text,
ADD COLUMN IF NOT EXISTS work_location text;

-- Add comments for documentation
COMMENT ON COLUMN registered_people.home_location IS 'Member home location/address';
COMMENT ON COLUMN registered_people.work_location IS 'Member work location/address';
