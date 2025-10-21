-- Add departments table and update users table
-- Migration: Create departments management system

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  leader_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Remove department_name from users table (users will be assigned via departments.leader_id instead)
ALTER TABLE users DROP COLUMN IF EXISTS department_name;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_departments_leader_id ON departments(leader_id);

-- Add comments for documentation
COMMENT ON TABLE departments IS 'Church departments with assigned leaders';
COMMENT ON COLUMN departments.name IS 'Department name (must be unique)';
COMMENT ON COLUMN departments.description IS 'Department description/purpose';
COMMENT ON COLUMN departments.leader_id IS 'User ID of the department leader (sheep_seeker)';
