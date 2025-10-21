# User Management Update - Implementation Guide

## Overview
User management has been updated to properly handle user registration with names and emails. Users are no longer assigned departments or roles during creation - these are assigned later when needed.

## What Changed

### Database Schema (Migration 003)
**New columns added to `users` table:**
- `first_name` - User's first name (required during registration)
- `last_name` - User's last name (required during registration)
- `email` - User's email address (optional, unique if provided)

**Columns removed:**
- `department_name` - No longer needed (users get departments via separate assignment)

**Column modifications:**
- `role` - Now nullable (assigned when user is given a department/responsibility)

### API Changes

#### `/api/auth/register` (User Creation)
**Required fields:**
- `first_name` ✅
- `last_name` ✅
- `username` ✅
- `password` ✅
- `phone_number` ✅

**Optional fields:**
- `email` (validated if provided)

**Removed fields:**
- ~~`role`~~ (assigned later)
- ~~`department_name`~~ (assigned separately)

#### `/api/users` (GET - List Users)
**Returns:**
```json
{
  "users": [
    {
      "id": "uuid",
      "username": "johndoe",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone_number": "+233244123456",
      "role": null,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### UI Changes

#### User Creation Form (`/super-admin/users/create`)
**New layout:**
1. First Name (required)
2. Last Name (required)
3. Email (optional)
4. Username (required)
5. Password (required)
6. Phone Number (required)

**Removed:**
- Role selection dropdown
- Department selection

#### Users List (`/super-admin/users`)
**New columns:**
- Name (first + last name combined)
- Username
- Email
- Phone
- Role (shows "Not Assigned" if null)
- Created At
- Actions

## How to Use

### Step 1: Run Database Migrations
Before creating users, run the migrations to add the new fields:

**Option A: Using Web Interface**
1. Visit: `http://localhost:3000/run-migrations.html`
2. Click "Run Migrations"
3. Wait for success confirmation

**Option B: Using Neon Console**
1. Go to https://console.neon.tech
2. Open SQL Editor
3. Run migration 003 SQL from `supabase/migrations/003_add_user_name_email.sql`

### Step 2: Create Users
1. Go to Super Admin Dashboard
2. Click "User Management"
3. Click "Create New User"
4. Fill in:
   - First Name: John
   - Last Name: Doe
   - Email: john.doe@example.com (optional)
   - Username: johndoe
   - Password: securepassword
   - Phone: +233244123456
5. Click "Create User"

### Step 3: Assign Roles/Departments (Future)
- Users are created without roles
- Roles will be assigned when:
  - User is made a Super Admin
  - User is assigned to a department as a Sheep Seeker
  - User is assigned as a department leader

## Migration Details

### Migration 003: Add User Name and Email Fields

```sql
-- Add name and email fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS email text;

-- Make role nullable (assigned later)
ALTER TABLE users ALTER COLUMN role DROP NOT NULL;

-- Add unique constraint on email
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key 
ON users(email) WHERE email IS NOT NULL;

-- Drop department_name column
ALTER TABLE users DROP COLUMN IF EXISTS department_name;
```

## Error Handling

### Common Issues

**Issue:** "column 'first_name' does not exist"
**Solution:** Run migration 003 first (see Step 1 above)

**Issue:** "email already exists"
**Solution:** Email must be unique. Use a different email or leave blank.

**Issue:** "Department name is required for Sheep Seekers"
**Solution:** Old error - clear browser cache and refresh the page

## Files Modified

### Backend
- ✅ `app/api/auth/register/route.ts` - Updated to handle new fields
- ✅ `app/api/users/route.ts` - Returns new fields in user list
- ✅ `app/api/run-migrations/route.ts` - Added migration 003

### Frontend
- ✅ `app/super-admin/users/create/page.tsx` - New form with name/email fields
- ✅ `app/super-admin/users/page.tsx` - Updated table to show new fields

### Database
- ✅ `supabase/migrations/003_add_user_name_email.sql` - New migration file

## Testing Checklist

- [ ] Run migrations successfully
- [ ] Create a user with all fields
- [ ] Create a user without email (optional field)
- [ ] Verify email uniqueness constraint
- [ ] Check users list shows all new fields
- [ ] Verify role shows "Not Assigned" for new users
- [ ] Delete a user (not admin)

## Next Steps

After this update, you'll need to implement:
1. **Department Assignment** - API/UI to assign users to departments
2. **Role Assignment** - When user gets department, they get "sheep_seeker" role
3. **Super Admin Promotion** - API/UI to promote users to super_admin
4. **Department Leader Assignment** - When user becomes leader, update department.leader_id

## Architecture Notes

### User Lifecycle
```
1. User Created (no role, no department)
   ↓
2. User Assigned to Department
   ↓
3. Role automatically set to "sheep_seeker"
   ↓
4. (Optional) User promoted to Super Admin or Department Leader
```

### Role vs Department
- **Role:** System-level permission (super_admin, sheep_seeker, or null)
- **Department:** Assigned separately via department assignment
- A user can exist without a role until they're assigned responsibilities

---

**Status:** ✅ Implementation Complete
**Version:** 1.0.0
**Date:** October 19, 2025
