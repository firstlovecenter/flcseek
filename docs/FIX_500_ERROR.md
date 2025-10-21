# URGENT FIX: Run Migrations First!

## The Error You're Seeing

```
POST http://localhost:3000/api/auth/register 500 (Internal Server Error)
```

## Root Cause

The database columns `first_name`, `last_name`, and `email` don't exist yet in the `users` table.

## IMMEDIATE FIX (Do This First!)

### Step 1: Run Migrations
```
1. Open your browser
2. Go to: http://localhost:3000/run-migrations.html
3. Click "Run Migrations"
4. Wait for success message
```

**OR** use Neon Console:

```
1. Go to: https://console.neon.tech
2. Select your project
3. Open SQL Editor
4. Copy and paste this SQL:
```

```sql
-- Add name and email fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS email text;

-- Make role nullable
ALTER TABLE users ALTER COLUMN role DROP NOT NULL;

-- Add unique constraint on email
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key 
ON users(email) WHERE email IS NOT NULL;

-- Drop department_name column
ALTER TABLE users DROP COLUMN IF EXISTS department_name;
```

```
5. Click "Run"
6. Wait for success
```

### Step 2: Try Creating User Again

After migrations complete:
```
1. Refresh the create user page
2. Fill in the form:
   - First Name: Noble
   - Last Name: Nketiah
   - Username: nnketiah@gmail.com
   - Email: (auto-filled)
   - Password: nketiah123
   - Phone: +233545248517
3. Click "Create User"
```

## Why This Happens

The code expects these columns to exist:
- `first_name`
- `last_name`
- `email`

But the database was created with the old schema that didn't have these columns.

## How to Verify Migrations Worked

After running migrations, you can verify in Neon Console:

```sql
-- Check if columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

You should see:
- ✅ first_name (text, YES)
- ✅ last_name (text, YES)
- ✅ email (text, YES)
- ✅ role (text, YES) -- now nullable
- ❌ department_name -- should NOT appear

## Quick Commands

**Check if dev server is running:**
```powershell
# If not running, start it:
npm run dev
```

**Visit migration page:**
```
http://localhost:3000/run-migrations.html
```

**After migrations, create user:**
```
http://localhost:3000/super-admin/users/create
```

---

**DO THIS NOW:** Run migrations before trying to create any users!
