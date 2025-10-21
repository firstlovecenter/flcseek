-- Add name and email fields to users table
-- Remove department_name as users are assigned departments separately

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS email text;

-- Make role nullable (assigned when user gets a department)
ALTER TABLE users ALTER COLUMN role DROP NOT NULL;

-- Add unique constraint on email
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users(email) WHERE email IS NOT NULL;

-- Drop department_name column if it exists
ALTER TABLE users DROP COLUMN IF EXISTS department_name;

-- Add comment
COMMENT ON TABLE users IS 'System users - Super Admins and Sheep Seekers. Role is assigned when user is assigned to a department.';
