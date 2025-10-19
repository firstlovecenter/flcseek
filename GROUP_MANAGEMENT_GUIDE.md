# Group Management System - Complete Guide

## Overview
The system has been updated from "Departments" to "Groups" terminology throughout. This provides a more flexible organizational structure.

## What Changed

### Database Migration (004_rename_departments_to_groups.sql)

**Table Changes:**
- ✅ `departments` table → `groups` table
- ✅ `registered_people.department_name` → `registered_people.group_name`
- ✅ Updated all indexes and constraints

**SQL Changes:**
```sql
-- Rename table
ALTER TABLE departments RENAME TO groups;

-- Rename column in registered_people
ALTER TABLE registered_people 
RENAME COLUMN department_name TO group_name;

-- Update indexes
DROP INDEX IF EXISTS idx_registered_people_department;
CREATE INDEX idx_registered_people_group ON registered_people(group_name);
CREATE INDEX idx_groups_leader ON groups(leader_id);
```

### New API Endpoints

#### GET /api/groups
**Description:** List all groups with leader information and member counts

**Response:**
```json
{
  "groups": [
    {
      "id": "uuid",
      "name": "Youth Group",
      "description": "For young adults 18-35",
      "leader_id": "uuid",
      "leader_username": "johndoe",
      "leader_first_name": "John",
      "leader_last_name": "Doe",
      "member_count": 25,
      "created_at": "2025-10-19T00:00:00Z",
      "updated_at": "2025-10-19T00:00:00Z"
    }
  ]
}
```

#### POST /api/groups
**Description:** Create a new group

**Request Body:**
```json
{
  "name": "Youth Group",
  "description": "For young adults 18-35",
  "leader_id": "user-uuid" // Optional
}
```

**Features:**
- ✅ Validates unique group names
- ✅ Automatically assigns sheep_seeker role to leader
- ✅ Optional leader assignment

#### GET /api/groups/[id]
**Description:** Get detailed information about a specific group

#### PUT /api/groups/[id]
**Description:** Update group details

**Features:**
- ✅ Update name, description, leader
- ✅ Automatically updates all registered_people records if name changes
- ✅ Validates name uniqueness

#### DELETE /api/groups/[id]
**Description:** Delete a group

**Validation:**
- ❌ Cannot delete group with members
- ✅ Must reassign/remove members first

#### GET /api/groups/available-leaders
**Description:** Get all users who can be assigned as group leaders

**Returns:** Users with role `null` or `sheep_seeker` (excludes super_admins)

### New UI: Group Management Page

**Location:** `/super-admin/groups`

**Features:**

1. **View All Groups**
   - Table showing all groups
   - Columns: Name, Description, Leader, Member Count, Created Date
   - Sortable columns
   - Pagination

2. **Create Group**
   - Modal form
   - Fields:
     - Group Name (required)
     - Description (optional)
     - Group Leader (optional dropdown)
   - Auto-assigns sheep_seeker role to selected leader

3. **Edit Group**
   - Edit name, description, leader
   - Updates all related records automatically
   - Validates uniqueness

4. **Delete Group**
   - Confirmation dialog
   - Prevents deletion if group has members
   - Clear error messages

5. **Assign Leader**
   - Dropdown of available users
   - Shows current group assignment
   - Automatically updates user role

## How to Use

### Step 1: Run Migrations

**Option A: Web Interface**
```
1. Visit: http://localhost:3000/run-migrations.html
2. Click "Run Migrations"
3. Verify Migration 004 completes
```

**Option B: Neon Console**
```sql
-- Copy SQL from:
supabase/migrations/004_rename_departments_to_groups.sql

-- Run in Neon Console SQL Editor
```

### Step 2: Access Group Management

```
1. Login as Super Admin
2. Navigate to: http://localhost:3000/super-admin/groups
3. You'll see the Group Management interface
```

### Step 3: Create Your First Group

```
1. Click "Create New Group" button
2. Fill in:
   - Group Name: "Youth Group"
   - Description: "Ages 18-35"
   - Group Leader: Select from dropdown (optional)
3. Click "Create"
4. Group is created and leader is assigned sheep_seeker role
```

### Step 4: Edit or Delete Groups

**Edit:**
```
1. Click "Edit" button on any group
2. Modify fields
3. Click "Update"
4. All related records update automatically
```

**Delete:**
```
1. Click "Delete" button
2. Confirm deletion
3. If group has members, you'll get an error
4. Reassign members first, then delete
```

## User Workflow

### Creating Users and Assigning to Groups

```
Step 1: Create User
  ↓
  Visit: /super-admin/users/create
  Fill in: First Name, Last Name, Username, Phone
  Role: Not Assigned
  ↓
Step 2: Create Group
  ↓
  Visit: /super-admin/groups
  Click: "Create New Group"
  Assign User as Leader
  ↓
Step 3: User Becomes Sheep Seeker
  ↓
  User role automatically set to "sheep_seeker"
  User can now manage their group
```

## Migration 004 Details

### What It Does

1. **Renames Tables**
   - `departments` → `groups`

2. **Renames Columns**
   - `registered_people.department_name` → `group_name`

3. **Updates Indexes**
   - Drops old department indexes
   - Creates new group indexes

4. **Maintains Relationships**
   - `groups.leader_id` still references `users.id`
   - All foreign keys preserved

### Verification

After migration, verify in Neon Console:

```sql
-- Check table exists
SELECT * FROM groups;

-- Check column renamed
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'registered_people' 
AND column_name = 'group_name';

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('groups', 'registered_people');
```

## API Usage Examples

### Create a Group

```javascript
const response = await fetch('/api/groups', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Youth Group',
    description: 'For young adults',
    leader_id: 'user-uuid' // Optional
  })
});

const data = await response.json();
// { message: 'Group created successfully', group: {...} }
```

### Update a Group

```javascript
const response = await fetch(`/api/groups/${groupId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Senior Youth',
    description: 'Updated description',
    leader_id: 'new-leader-uuid'
  })
});
```

### Get Available Leaders

```javascript
const response = await fetch('/api/groups/available-leaders', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
// { users: [{id, username, first_name, last_name, current_group, ...}] }
```

## File Structure

### New Files Created
```
app/
  api/
    groups/
      route.ts                    # GET, POST groups
      [id]/route.ts              # GET, PUT, DELETE group
      available-leaders/route.ts # GET available users
  super-admin/
    groups/
      page.tsx                   # Group management UI
supabase/
  migrations/
    004_rename_departments_to_groups.sql
```

### Modified Files
```
app/
  api/
    run-migrations/route.ts      # Added migration 004
public/
  run-migrations.html            # Updated to show migration 004
```

## Permissions

### Super Admin Only
- ✅ Create groups
- ✅ Edit groups
- ✅ Delete groups
- ✅ Assign leaders
- ✅ View all groups

### Sheep Seekers
- Can view their assigned group (future feature)
- Can manage members in their group

## Features

### Automatic Role Assignment
When a user is assigned as a group leader:
```
1. User role checked
2. If role is NULL → set to "sheep_seeker"
3. If role is "sheep_seeker" → no change
4. Super admins cannot be group leaders
```

### Name Change Handling
When a group name is changed:
```
1. Validate new name is unique
2. Update groups table
3. Automatically update ALL registered_people records
4. Update group_name for all members
```

### Delete Protection
Cannot delete a group if:
```
- Group has members (member_count > 0)
- Error message shows member count
- Must reassign/remove members first
```

## Troubleshooting

### Error: "Group name already exists"
**Solution:** Choose a different group name

### Error: "Cannot delete group with X members"
**Solution:** 
1. Reassign members to another group
2. Or remove members from group
3. Then delete the group

### Error: "Leader user not found"
**Solution:** Refresh available leaders list

### Migration fails
**Solution:**
1. Check if tables exist: `SELECT * FROM departments;`
2. If error, tables already renamed
3. Skip migration or use Neon Console

## Next Steps

After setting up groups:

1. **Populate Members**
   - Visit `/populate-database.html`
   - Populate with sample data
   - Members will be assigned to groups

2. **Assign More Leaders**
   - Edit existing groups
   - Assign leaders from user list

3. **Customize Groups**
   - Add descriptions
   - Organize by purpose (age, location, etc.)

---

**Status:** ✅ Complete
**Version:** 1.0.0
**Date:** October 19, 2025
