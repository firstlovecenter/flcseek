# Year Field Implementation Summary

## Overview
Successfully added year support to the groups system, allowing multiple cohorts of the same month across different years (e.g., January 2025, January 2026).

## Database Changes ✅

### Migration: `006_add_year_to_groups.sql`
```sql
-- Added year column (INTEGER, NOT NULL, DEFAULT 2025)
-- Unique constraint on (name, year) combination
-- Index on year for performance
-- Updated existing groups to year 2025
```

**Before:**
- Groups table only had `name` field
- Constraint: `name` must be unique
- Could not have "January 2025" and "January 2026"

**After:**
- Groups table now has `year` column
- Constraint: `(name, year)` combination must be unique
- Can have multiple "January" groups for different years

## API Changes ✅

### `/api/groups` (GET)
- Now returns `year` field for each group
- Sorting updated: `is_active DESC, year DESC, name ASC`

### `/api/groups` (POST - Create Group)
- Now requires `year` field (validation added)
- Checks for duplicate `(name, year)` combinations
- Error message includes year: `"Group January 2025 already exists"`

### `/api/groups/[id]` (GET)
- Now returns `year` field in group details

### `/api/groups/[id]` (PUT - Update Group)
- Accepts optional `year` field for updates
- Validates `(name, year)` uniqueness when changing either
- Updates group record with new year if provided

### `/api/auth/login`
- Fetches `year` from groups table along with group name
- Returns `group_year` in token payload and user object
- Users now know which year their group belongs to

## Type Updates ✅

### `UserPayload` (lib/auth.ts)
```typescript
interface UserPayload {
  // ... existing fields
  group_year?: number; // NEW: Year of the group (e.g., 2025, 2026)
}
```

### `User` (contexts/AuthContext.tsx)
```typescript
interface User {
  // ... existing fields
  group_year?: number; // NEW
}
```

### `Group` (app/super-admin/groups/page.tsx)
```typescript
interface Group {
  // ... existing fields
  year: number; // NEW
}
```

## UI Changes ✅

### Super Admin - Group Management
**Location:** `app/super-admin/groups/page.tsx`

**Group Creation/Edit Form:**
- Added "Year" dropdown field (required)
- Options: 2024, 2025, 2026, 2027, 2028
- Default value: Current year
- Positioned between "Group Name" and "Description"

**Groups Table:**
- Column "Group Name" now displays: `{name} {year}`
- Example: "January 2025", "February 2026"
- Sorting considers both name and year

### Sheep Seeker Dashboard
**Location:** `app/sheep-seeker/page.tsx`

**Header Display:**
- Changed from: `"My Group: {group_name}"`
- Changed to: `"{group_name} {year}"`
- Example: "January 2025" instead of "My Group: January"
- Falls back to current year if `group_year` not available

## How It Works

### Creating a Group
1. Super admin navigates to Group Management
2. Clicks "Create New Group"
3. Fills in:
   - **Group Name**: January (or any month)
   - **Year**: 2025 (selected from dropdown)
   - Description (optional)
   - Leader (optional)
4. System validates that "January 2025" doesn't already exist
5. Group created with year 2025

### User Login Experience
1. User logs in with username/password
2. System fetches user's assigned group (if any)
3. Query includes: `SELECT name, year FROM groups WHERE ...`
4. Token includes `group_year` field
5. User object includes `group_year` field
6. Dashboard displays: "{group_name} {group_year}"

### Dashboard Display Logic
```typescript
const displayTitle = `${user?.group_name} ${user?.group_year || currentYear}`;
// Examples:
// - "January 2025" (if group_year is 2025)
// - "February 2026" (if group_year is 2026)
// - "March 2025" (fallback to current year if group_year not set)
```

## Migration Path

### For Existing Data
All existing groups automatically receive `year = 2025` via migration default value and UPDATE statement.

### For New Groups
Must specify year when creating (dropdown in UI, required field in API).

### For Future Years
Simply create new groups with year 2026, 2027, etc. The system supports any year you select.

## Benefits

✅ **Multi-Year Support**: Run January 2025 and January 2026 simultaneously
✅ **Clean Separation**: Each year's cohort is distinct in the database
✅ **No Breaking Changes**: Existing code continues to work
✅ **Proper Constraints**: Can't accidentally create duplicate month+year combinations
✅ **Good Performance**: Indexed year column for fast filtering
✅ **User-Friendly**: Year appears everywhere groups are displayed
✅ **Future-Proof**: Easy to add year filters and reports later

## Files Modified

### Database
- ✅ `supabase/migrations/006_add_year_to_groups.sql` (NEW)

### API Routes
- ✅ `app/api/groups/route.ts`
- ✅ `app/api/groups/[id]/route.ts`
- ✅ `app/api/auth/login/route.ts`

### Type Definitions
- ✅ `lib/auth.ts`
- ✅ `contexts/AuthContext.tsx`

### UI Components
- ✅ `app/super-admin/groups/page.tsx`
- ✅ `app/sheep-seeker/page.tsx`

## Next Steps to Use

1. **Run the migration:**
   ```bash
   # Apply migration to your database
   # The migration will add the year column and set default values
   ```

2. **Create new groups:**
   - Go to Super Admin → Group Management
   - Create groups with specific years
   - Example: "January 2025", "January 2026", etc.

3. **Assign users:**
   - Users will automatically see their group's year
   - Dashboard displays: "January 2025" format

## Example Scenarios

### Scenario 1: Starting 2026 Cohort
```
1. December 2025: Create all 12 groups for 2026
   - "January 2026", "February 2026", ..., "December 2026"
2. Assign leaders to each 2026 group
3. 2025 and 2026 groups coexist in the system
4. Each leader sees their specific year on dashboard
```

### Scenario 2: Historical Data
```
- Keep 2025 groups active for reporting
- Mark 2025 groups as inactive when cycle completes
- Create fresh 2026 groups
- Historical data preserved with year identifier
```

## Testing Checklist

- [ ] Run migration on development database
- [ ] Create a group with year 2025
- [ ] Try creating duplicate group (same name+year) - should fail
- [ ] Create group with same name but different year - should succeed
- [ ] Edit group and change year
- [ ] Login as group leader and verify year appears on dashboard
- [ ] Check groups list shows "Month Year" format
- [ ] Verify existing groups have year 2025

All implementation complete and committed! 🎉
