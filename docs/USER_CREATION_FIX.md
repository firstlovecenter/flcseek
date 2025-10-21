# User Creation Fix

## Issue
User creation was failing with 400 Bad Request errors because the form was missing required fields.

## Root Cause
The `/api/auth/register` endpoint requires:
- ✅ username
- ✅ password
- ✅ role
- ❌ **phone_number** (was missing from form)
- ❌ **department_name** (required for Sheep Seekers, was missing)

## Fix Applied
Updated `app/super-admin/users/create/page.tsx` to include:

### 1. Added Phone Number Field
```tsx
<Form.Item
  name="phone_number"
  label="Phone Number"
  rules={[
    { required: true, message: 'Please enter phone number' },
    { pattern: /^[0-9+\-\s()]+$/, message: 'Invalid phone number format' },
  ]}
>
  <Input placeholder="+233 123 456 789" size="large" />
</Form.Item>
```

### 2. Added Department Field (Conditional)
Shows only when "Sheep Seeker" role is selected:
```tsx
{selectedRole === 'sheep_seeker' && (
  <Form.Item
    name="department_name"
    label="Department"
    rules={[
      { required: true, message: 'Please select department for Sheep Seeker' },
    ]}
  >
    <Select placeholder="Select department" size="large">
      {DEPARTMENTS.map((dept) => (
        <Select.Option key={dept} value={dept}>
          {dept}
        </Select.Option>
      ))}
    </Select>
  </Form.Item>
)}
```

### 3. Added Role State Tracking
```tsx
const [selectedRole, setSelectedRole] = useState('sheep_seeker');
```

## Changes Made
1. ✅ Import `DEPARTMENTS` from constants
2. ✅ Add state for tracking selected role
3. ✅ Add phone_number field (required for all users)
4. ✅ Add department_name field (required only for Sheep Seekers)
5. ✅ Add onChange handler to role selector
6. ✅ Add validation rules for phone format

## Form Fields Now Include

### For All Users:
- Username (required, min 3 chars)
- Password (required, min 6 chars)
- Phone Number (required, phone format)
- Role (required, default: Sheep Seeker)

### For Sheep Seekers Only:
- Department (required, one of 12 months)

### For Super Admins:
- Department (not required, field hidden)

## Testing
Try creating a user now:
1. Navigate to: Super Admin → Users → Create User
2. Fill in:
   - Username: jmensah
   - Password: jmensah (or any password)
   - Phone Number: 0244567890
   - Role: Sheep Seeker
   - Department: January (will appear when Sheep Seeker is selected)
3. Click "Create User"

## Expected Result
✅ User should be created successfully
✅ Success message should appear
✅ Redirects to users list
✅ New user appears in the table

## Database Schema Compliance
The form now matches the database schema:
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL,
  department_name text,      -- ✅ Now included in form
  phone_number text NOT NULL, -- ✅ Now included in form
  created_at timestamptz,
  updated_at timestamptz
);
```

## Notes
- Phone number validation accepts formats like:
  - +233 123 456 789
  - 0244567890
  - +233-123-456-789
  - (233) 123 456 789
- Department field dynamically shows/hides based on role selection
- Department is required for Sheep Seekers but not for Super Admins
