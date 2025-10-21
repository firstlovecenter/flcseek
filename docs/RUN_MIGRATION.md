# Quick Start: Run Location Fields Migration

## Apply Database Changes

To add the location fields to your database, run the migration SQL directly:

### Option 1: Using psql (Command Line)
```bash
# Set your database URL
$env:DATABASE_URL = (Get-Content .env.local | Select-String "DATABASE_URL").ToString().Split('=')[1].Trim()

# Run the migration
psql $env:DATABASE_URL -f supabase/migrations/002_add_location_fields.sql
```

### Option 2: Using Neon Console
1. Go to your Neon Console: https://console.neon.tech
2. Select your project
3. Go to SQL Editor
4. Copy and paste the contents of `supabase/migrations/002_add_location_fields.sql`
5. Execute the query

### Option 3: Using Database Client (DBeaver, pgAdmin, etc.)
1. Connect to your database
2. Open a new SQL query window
3. Copy and paste the contents of `supabase/migrations/002_add_location_fields.sql`
4. Execute the query

## Migration SQL Content

```sql
-- Add location fields to registered_people table
-- Migration: Add home_location and work_location columns

ALTER TABLE registered_people 
ADD COLUMN IF NOT EXISTS home_location text,
ADD COLUMN IF NOT EXISTS work_location text;

-- Add comments for documentation
COMMENT ON COLUMN registered_people.home_location IS 'Member home location/address';
COMMENT ON COLUMN registered_people.work_location IS 'Member work location/address';
```

## Verify Migration

After running the migration, verify the columns were added:

```sql
-- Check table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'registered_people' 
  AND column_name IN ('home_location', 'work_location');
```

Expected output:
```
 column_name    | data_type | is_nullable 
----------------+-----------+-------------
 home_location  | text      | YES
 work_location  | text      | YES
```

## What's Next

After the migration:
1. ✅ All registration forms now support location fields
2. ✅ Excel bulk upload template includes location columns
3. ✅ Person profile pages display location information
4. ✅ API endpoints accept and return location data
5. ✅ No code changes needed - just run the migration!

## Rollback (If Needed)

If you need to remove the location fields:

```sql
ALTER TABLE registered_people 
DROP COLUMN IF EXISTS home_location,
DROP COLUMN IF EXISTS work_location;
```

---

**All code changes are complete** - just run the migration above to enable location tracking! 🎉
