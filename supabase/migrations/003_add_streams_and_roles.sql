-- Migration: Add Streams and Update User Roles
-- This migration creates the new hierarchical structure:
-- Lead Pastor > Stream Leader > Sheep Seeker > Group

-- First, update the role check constraint to include new roles
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
  END IF;
  
  -- Add updated constraint with new roles
  ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('super_admin', 'lead_pastor', 'stream_leader', 'sheep_seeker'));
END $$;

-- Create streams table
CREATE TABLE IF NOT EXISTS streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  stream_leader_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Modify existing groups table to support the new architecture
-- Add new columns for stream relationship and lifecycle tracking
ALTER TABLE groups ADD COLUMN IF NOT EXISTS stream_id uuid;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS start_date date DEFAULT CURRENT_DATE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Rename leader_id to sheep_seeker_id for clarity
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' AND column_name = 'leader_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' AND column_name = 'sheep_seeker_id'
  ) THEN
    ALTER TABLE groups RENAME COLUMN leader_id TO sheep_seeker_id;
  END IF;
END $$;

-- Add foreign key constraints after columns exist
DO $$
BEGIN
  -- Add stream_id foreign key if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'groups_stream_id_fkey'
  ) THEN
    ALTER TABLE groups ADD CONSTRAINT groups_stream_id_fkey 
      FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update users table to support new roles and stream assignment
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_id uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS group_id uuid;

-- Add foreign key constraints for users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_stream_id_fkey'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_stream_id_fkey 
      FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_group_id_fkey'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_group_id_fkey 
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update registered_people table to reference groups
ALTER TABLE registered_people ADD COLUMN IF NOT EXISTS group_id uuid;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'registered_people_group_id_fkey'
  ) THEN
    ALTER TABLE registered_people ADD CONSTRAINT registered_people_group_id_fkey 
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_streams_leader ON streams(stream_leader_id);
CREATE INDEX IF NOT EXISTS idx_groups_stream ON groups(stream_id);
CREATE INDEX IF NOT EXISTS idx_groups_sheep_seeker ON groups(sheep_seeker_id);
CREATE INDEX IF NOT EXISTS idx_users_stream ON users(stream_id);
CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_id);
CREATE INDEX IF NOT EXISTS idx_groups_active ON groups(is_active);
CREATE INDEX IF NOT EXISTS idx_registered_people_group ON registered_people(group_id);

-- Add trigger to update updated_at timestamp for streams
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_streams_updated_at 
  BEFORE UPDATE ON streams 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at 
  BEFORE UPDATE ON groups 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE streams IS 'Organizational streams, each led by a stream_leader';
COMMENT ON TABLE groups IS 'Sheep seeking groups with 6-month lifecycle, belonging to a stream';
COMMENT ON COLUMN groups.start_date IS 'Start date of the 6-month group cycle';
COMMENT ON COLUMN groups.end_date IS 'End date of the 6-month group cycle (start_date + 6 months)';
COMMENT ON COLUMN groups.is_active IS 'Whether the group is currently active';
COMMENT ON COLUMN users.stream_id IS 'Stream assignment for stream_leaders and their team';
COMMENT ON COLUMN users.group_id IS 'Group assignment for sheep_seekers';
