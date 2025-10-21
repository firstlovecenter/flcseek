-- Convert all 'leader' role users to 'admin' role
-- This updates sheep seekers to have admin privileges for bulk registration and other admin features

-- Update all users with 'leader' role to 'admin' role
UPDATE users 
SET role = 'admin' 
WHERE role = 'leader';

-- Add comment to document the change
COMMENT ON COLUMN users.role IS 'User role: superadmin (full access), leadpastor (view all), admin (edit assigned group with bulk features), leader (deprecated - converted to admin)';

-- Log the number of users updated
-- This is informational only - the actual count will show in migration output
SELECT COUNT(*) as users_converted_to_admin 
FROM users 
WHERE role = 'admin';
