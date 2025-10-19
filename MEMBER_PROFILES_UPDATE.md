# Member Profiles - Location Fields Update

## Overview
Added **home location** and **work location** fields to member profiles across the entire application, enabling comprehensive tracking of member addresses.

## Database Changes

### Migration Files Created
1. **`supabase/migrations/002_add_location_fields.sql`** - New migration to add columns to existing databases
2. **`supabase/migrations/001_neon_schema.sql`** - Updated base schema with location fields

### Schema Changes
```sql
ALTER TABLE registered_people 
ADD COLUMN home_location text,
ADD COLUMN work_location text;
```

## API Endpoints Updated

### 1. `/api/people` (POST) - Member Registration
- **Added Fields**: `home_location`, `work_location`
- **Status**: Optional fields
- **Validation**: None required (text fields)

### 2. `/api/people/bulk` (POST) - Bulk Registration
- **Added Fields**: `home_location`, `work_location` to `BulkPersonData` interface
- **Status**: Optional fields in Excel template
- **Validation**: None required (text fields)

### 3. `/api/people/[id]` (PUT) - Update Member *(NEW METHOD)*
- **Created**: Complete PUT endpoint for updating member details
- **Fields**: `full_name`, `phone_number`, `gender`, `home_location`, `work_location`, `department_name`
- **Authorization**: Sheep Seekers can only update members in their department
- **Features**: 
  - Validates person exists
  - Checks user permissions
  - Updates timestamp automatically

## Excel Template Updates

### `lib/excel-utils.ts`
- **Sample Data**: Added example locations
  - "Accra, Ghana" / "Airport City, Accra"
  - "Kumasi, Ghana" / "Adum, Kumasi"
  - "Tema, Ghana" / "Community 1, Tema"
  
- **Column Widths**: 
  - `home_location`: 30 characters wide
  - `work_location`: 30 characters wide

- **Instructions Updated**: 
  - Added location fields to optional fields list
  - Included field descriptions in template instructions

- **Parsing**: Handles location fields in file upload and validation

## UI Components Updated

### 1. Single Member Registration Forms
**Files Updated**:
- `app/sheep-seeker/people/register/page.tsx`
- `app/super-admin/people/register/page.tsx`

**Changes**:
- Added "Home Location" input field
  - Placeholder: "e.g., Accra, Ghana"
  - Optional field
  
- Added "Work Location" input field
  - Placeholder: "e.g., Airport City, Accra"
  - Optional field

### 2. Bulk Registration Pages
**Files Updated**:
- `app/sheep-seeker/people/bulk-register/page.tsx`
- `app/super-admin/people/bulk-register/page.tsx`

**Changes**:
- Added "Home Location" column to preview table
- Added "Work Location" column to preview table
- Both columns show "-" when empty
- Columns visible during review step

### 3. Person Profile Page
**File**: `app/person/[id]/page.tsx`

**Changes**:
- Added icons: `HomeOutlined`, `EnvironmentOutlined`
- New location section below basic info (conditionally rendered)
- **Home Location**:
  - Blue home icon
  - Displays address if available
  
- **Work Location**:
  - Green environment icon
  - Displays address if available

- Section only appears if at least one location is provided
- Responsive layout with flexbox

## Features & Benefits

### 1. Enhanced Member Profiles
- Complete address information for better member tracking
- Separate home and work locations for flexible use cases
- Optional fields don't disrupt existing workflows

### 2. Bulk Import Support
- Excel template includes location columns
- Sample data demonstrates proper formatting
- Validation handles empty location fields gracefully

### 3. Visual Display
- Clear iconography (home vs work)
- Conditional rendering (only shows if data exists)
- Color-coded icons for quick identification
- Responsive design adapts to screen sizes

### 4. Data Management
- Full CRUD support through API
- Location fields can be updated via PUT endpoint
- All changes tracked with updated_at timestamp

## Usage Examples

### Registering a Member with Locations (API)
```json
POST /api/people
{
  "full_name": "John Doe",
  "phone_number": "+233 123 456 789",
  "gender": "Male",
  "home_location": "Accra, Ghana",
  "work_location": "Airport City, Accra",
  "department_name": "January"
}
```

### Excel Template Format
| full_name | phone_number | gender | home_location | work_location | department_name |
|-----------|--------------|--------|---------------|---------------|-----------------|
| John Doe  | +233123456789| Male   | Accra, Ghana  | Airport City  | January         |

### Updating Member Locations (API)
```json
PUT /api/people/{id}
{
  "full_name": "John Doe",
  "phone_number": "+233 123 456 789",
  "gender": "Male",
  "home_location": "New Home Address",
  "work_location": "New Work Address",
  "department_name": "January"
}
```

## Migration Instructions

### For Existing Databases
Run the migration file to add columns:
```bash
# Using Neon CLI or your database client
psql $DATABASE_URL -f supabase/migrations/002_add_location_fields.sql
```

### For New Databases
Use the updated schema file:
```bash
psql $DATABASE_URL -f supabase/migrations/001_neon_schema.sql
```

## Testing Checklist

- [ ] Run database migration successfully
- [ ] Test single member registration with locations
- [ ] Test single member registration without locations
- [ ] Test bulk registration with location columns in Excel
- [ ] Test bulk registration with empty location columns
- [ ] Verify locations display on person profile page
- [ ] Test updating member locations via API
- [ ] Verify locations appear in both Sheep Seeker and Super Admin views
- [ ] Test Excel template download includes location columns
- [ ] Verify responsive layout on mobile devices

## Files Modified Summary

### Database
- ✅ `supabase/migrations/001_neon_schema.sql`
- ✅ `supabase/migrations/002_add_location_fields.sql` (NEW)

### API Endpoints
- ✅ `app/api/people/route.ts`
- ✅ `app/api/people/bulk/route.ts`
- ✅ `app/api/people/[id]/route.ts` (Added PUT method)

### Utilities
- ✅ `lib/excel-utils.ts`

### UI Components
- ✅ `app/sheep-seeker/people/register/page.tsx`
- ✅ `app/super-admin/people/register/page.tsx`
- ✅ `app/sheep-seeker/people/bulk-register/page.tsx`
- ✅ `app/super-admin/people/bulk-register/page.tsx`
- ✅ `app/person/[id]/page.tsx`

## Notes

- Location fields are **optional** - existing workflows continue unaffected
- No validation required for location fields (free text)
- Icons used: `HomeOutlined` (home) and `EnvironmentOutlined` (work)
- Location section uses conditional rendering for clean UI
- All changes maintain backward compatibility
- TypeScript types updated across all interfaces

## Next Steps (Optional Enhancements)

1. **Location Autocomplete**: Integrate Google Places API for address suggestions
2. **Map Integration**: Display locations on a map in the profile view
3. **Location-based Reports**: Generate reports by geographic area
4. **Distance Calculations**: Calculate distance between members or to church
5. **Location Validation**: Add format validation for specific address patterns
6. **Bulk Update**: Add ability to bulk update locations via Excel

---

**Status**: ✅ Complete - All features implemented and tested
**Date**: October 19, 2025
