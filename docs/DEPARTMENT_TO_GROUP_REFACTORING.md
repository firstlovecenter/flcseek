# Department → Group Refactoring - COMPLETE GUIDE

## Overview
This document tracks the complete refactoring from "department" to "group" terminology throughout the FLC Sheep Seeking application.

## ✅ COMPLETED FILES

### 1. Core Backend Files
- ✅ `lib/constants.ts` - Changed DEPARTMENTS to GROUPS (kept DEPARTMENTS as deprecated alias)
- ✅ `lib/auth.ts` - Updated UserPayload interface (department_name → group_name)
- ✅ `lib/excel-utils.ts` - Updated all template generation and validation logic
- ✅ `contexts/AuthContext.tsx` - Updated User interface

### 2. API Routes
- ✅ `app/api/auth/login/route.ts` - Changed department_name to group_name, departments to groups table
- ✅ `app/api/people/route.ts` - Updated POST and GET routes
- ✅ `app/api/people/[id]/route.ts` - Updated GET and PUT routes
- ✅ `app/api/people/bulk/route.ts` - Updated bulk registration interface and logic
- ✅ `app/api/progress/[person_id]/route.ts` - Updated access control
- ✅ `app/api/attendance/[person_id]/route.ts` - Updated access control
- ✅ `app/api/departments/summary/route.ts` - Changed to use groups table and group_name

### 3. Frontend Pages (Partial)
- ✅ `app/super-admin/page.tsx` - Main dashboard updated (DepartmentSummary → GroupSummary)

## 🔄 REMAINING FILES (Use PowerShell Script)

Run the provided `update-department-to-group.ps1` script to update these files:

### Super Admin Pages
- ⏳ `app/super-admin/people/page.tsx`
- ⏳ `app/super-admin/people/register/page.tsx`
- ⏳ `app/super-admin/people/bulk-register/page.tsx`
- ⏳ `app/super-admin/sms/send/page.tsx`
- ⏳ `app/super-admin/sms/logs/page.tsx`
- ⏳ `app/super-admin/reports/overview/page.tsx`
- ⏳ `app/super-admin/reports/attendance/page.tsx`
- ⏳ `app/super-admin/department/[month]/page.tsx`

### Sheep Seeker Pages
- ⏳ `app/sheep-seeker/page.tsx`
- ⏳ `app/sheep-seeker/people/page.tsx`
- ⏳ `app/sheep-seeker/people/register/page.tsx`
- ⏳ `app/sheep-seeker/people/bulk-register/page.tsx`
- ⏳ `app/sheep-seeker/attendance/page.tsx`
- ⏳ `app/sheep-seeker/progress/page.tsx`

### Person Pages
- ⏳ `app/person/[id]/page.tsx`

## 🗄️ DATABASE CHANGES

The database migration is already created:
- ✅ `supabase/migrations/004_rename_departments_to_groups.sql`

### Migration Changes:
1. Renames `departments` table → `groups` table
2. Renames `department_name` column → `group_name` in `registered_people` table
3. Updates all indexes and constraints

**Run this migration:**
```bash
# Using migration runner API
# Navigate to http://localhost:3000/run-migrations.html
# Or run via psql:
psql $DATABASE_URL -f supabase/migrations/004_rename_departments_to_groups.sql
```

## 📝 SEARCH & REPLACE PATTERNS

The PowerShell script performs these replacements:

### TypeScript/Interfaces
- `department_name:` → `group_name:`
- `department_name?:` → `group_name?:`
- `department_name =` → `group_name =`

### Variables
- `selectedDepartment` → `selectedGroup`
- `departmentName` → `groupName`
- `DepartmentSummary` → `GroupSummary`

### UI Text
- `Department:` → `Group:`
- `My Department:` → `My Group:`
- `'Department'` → `'Group'`
- `All Departments` → `All Groups`
- `Target Department` → `Target Group`

### Form Fields
- `dataIndex: 'department_name'` → `dataIndex: 'group_name'`
- `key: 'department_name'` → `key: 'group_name'`
- `name="department_name"` → `name="group_name"`

### Constants
- `DEPARTMENTS` → `GROUPS`

### Error Messages
- `in your department` → `in your group`
- `in their department` → `in their group`

## 🚀 EXECUTION STEPS

### 1. Run PowerShell Script
```powershell
cd "C:\Users\samuel cyrus-aduteye\Documents\Codeslaw\flcseek"
.\update-department-to-group.ps1
```

### 2. Run Database Migration
Navigate to `http://localhost:3000/run-migrations.html` and run migration 004.

### 3. Verify Changes
- Check for any remaining "department" references:
  ```powershell
  Get-ChildItem -Recurse -Include *.ts,*.tsx,*.sql | Select-String "department_name|departmentName" | Select-Object -First 20
  ```

### 4. Test Application
- Login as super_admin
- Check dashboard displays groups correctly
- Test people registration (group field)
- Test bulk registration (group field in Excel)
- Verify access control (sheep seekers can only see their group)

## 🔍 VERIFICATION CHECKLIST

After running the script:

- [ ] No TypeScript compilation errors
- [ ] All API routes return group_name instead of department_name
- [ ] Dashboard shows "Group" instead of "Department"
- [ ] People listing shows "Group" column
- [ ] Registration forms use "Group" field
- [ ] Bulk registration Excel template has "group_name" column
- [ ] Access control works (sheep seekers restricted to their group)
- [ ] Reports show group breakdown correctly

## ⚠️ IMPORTANT NOTES

1. **Database Migration Required**: The app will not work correctly until migration 004 is run.

2. **Backward Compatibility**: The constant `DEPARTMENTS` is kept as an alias to `GROUPS` for any code that might not be updated yet.

3. **Excel Templates**: Old Excel templates with "department_name" column will NOT work. Users must download new templates.

4. **API Responses**: All API responses now use `group_name` instead of `department_name`. Any external integrations must be updated.

5. **User Tokens**: Existing JWT tokens contain `department_name`. Users should log out and log back in after the update.

## 📊 IMPACT SUMMARY

### Files Changed: ~35
- Core libraries: 4
- API routes: 7
- Frontend pages: ~24
- Database migrations: 1

### Database Objects Changed:
- 1 table renamed (departments → groups)
- 1 column renamed (department_name → group_name)
- Multiple indexes updated
- Multiple constraints updated

### Breaking Changes:
- ✅ JWT token structure changed
- ✅ API request/response format changed  
- ✅ Excel template format changed
- ✅ Database schema changed

## 🎯 NEXT STEPS AFTER COMPLETION

1. Clear browser local storage (to remove old tokens)
2. Log out all users
3. Run database migration
4. Restart the application
5. Test all features
6. Update documentation
7. Notify users about new Excel template format

## 📞 SUPPORT

If you encounter issues:
1. Check TypeScript compilation errors first
2. Verify database migration was successful
3. Clear browser cache and local storage
4. Check browser console for errors
5. Verify API responses use group_name

---

**Last Updated**: October 19, 2025
**Status**: Backend Complete, Frontend Pending (use PowerShell script)
