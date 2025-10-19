# Quick Start: Department Management System

## Run Migration

Apply the database changes to enable department management:

### Option 1: Using Neon Console (Recommended)
1. Go to https://console.neon.tech
2. Select your project
3. Click "SQL Editor"
4. Copy and paste this SQL:

```sql
-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  leader_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Remove department_name from users table
ALTER TABLE users DROP COLUMN IF EXISTS department_name;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_departments_leader_id ON departments(leader_id);
```

5. Click "Run Query"

### Option 2: Using Command Line
```bash
# Set your database URL
$env:DATABASE_URL = (Get-Content .env.local | Select-String "DATABASE_URL").ToString().Split('=')[1].Trim()

# Run the migration
psql $env:DATABASE_URL -f supabase/migrations/003_create_departments_table.sql
```

## Verify Migration

Run this to confirm:

```sql
-- Should return empty (no errors)
SELECT * FROM departments;

-- Should NOT show department_name column
\d users;
```

## What's New?

### For Super Admins

1. **Navigate to Departments**
   - Sidebar → Departments → All Departments
   - OR Departments → Add New Department

2. **Create a Department**
   - Click "Add New Department"
   - Enter name (e.g., "Youth Ministry")
   - Add description (optional)
   - Select a leader from dropdown (optional)
   - Click "Create Department"

3. **Manage Departments**
   - View all departments in a table
   - Edit department details
   - Reassign leaders
   - Delete departments

### Updated User Creation

When creating users:
- ✅ Username, password, phone, role (same as before)
- ❌ Department field removed (no longer needed)
- 💡 Assign users as leaders separately in Departments section

## Navigation Updates

**Departments Menu Now Has:**
```
Departments
  ├─ All Departments (NEW!)
  ├─ Add New Department (NEW!)
  ├─ ──────────────────
  ├─ January
  ├─ February
  ├─ March
  └─ ... (etc)
```

## Quick Features

### Searchable Leader Selection
- Type to search by username or phone
- Only shows Sheep Seekers
- Filters out already-assigned leaders
- Shows format: "username (phone_number)"

### Department Table
- See all departments at a glance
- Leader info with icons (name + phone)
- Quick edit and delete actions
- "No Leader Assigned" tag for empty departments

## Example Workflow

### Create "Youth Ministry" Department

1. Click "Add New Department"
2. Enter:
   - Name: "Youth Ministry"
   - Description: "Ministry for young people and teens"
   - Leader: Search "john" → Select "john_doe (+233123456789)"
3. Click "Create Department"
4. ✅ Done! Department created with John as leader

### Reassign Leader

1. Go to "All Departments"
2. Find department
3. Click "Edit"
4. Change leader in dropdown
5. Click "Update Department"
6. ✅ Leader reassigned!

## API Endpoints (For Developers)

```
GET    /api/departments           - List all departments
POST   /api/departments           - Create department (super_admin)
GET    /api/departments/[id]      - Get single department
PUT    /api/departments/[id]      - Update department (super_admin)
DELETE /api/departments/[id]      - Delete department (super_admin)
GET    /api/users/sheep-seekers   - List sheep seeker users (super_admin)
```

## Troubleshooting

**"No available users" in dropdown**
- All Sheep Seekers are already assigned as leaders
- Solution: Create more users OR leave department without leader

**Cannot find "Add New Department" button**
- Make sure you're logged in as super_admin
- Check you're in the Departments section

**Migration error: "column department_name does not exist"**
- Column already removed - migration may have run already
- Verify with: `\d users` - department_name should NOT appear

## Need Help?

See full documentation: `DEPARTMENT_MANAGEMENT_COMPLETE.md`

---

**Ready to use!** 🎉 All code changes complete - just run the migration above.
