# Bulk Member Registration - User Guide

## Overview
The Bulk Member Registration feature allows Sheep Seekers and Super Admins to register multiple members at once using an Excel template. This significantly speeds up the registration process when adding many members.

## Features
✅ Download Excel template with instructions
✅ Upload Excel files (.xlsx, .xls)
✅ Automatic validation of all data
✅ Preview data before submission
✅ Error reporting with row numbers
✅ Bulk registration of up to 500 members
✅ Progress tracking initialization for all members
✅ Detailed success/failure reporting

## How to Use

### Step 1: Access Bulk Registration
**For Sheep Seekers:**
- Navigate to: People → Bulk Register
- Or go to: `/sheep-seeker/people/bulk-register`

**For Super Admins:**
- Navigate to: People Management → Bulk Register
- Or go to: `/super-admin/people/bulk-register`

### Step 2: Download Template
1. Click the **"Download Excel Template"** button
2. Save the file: `bulk_registration_template.xlsx`
3. The template includes:
   - **Members Sheet**: Main data entry sheet with sample data
   - **Instructions Sheet**: Detailed usage instructions
   - **Departments Sheet**: List of valid department names

### Step 3: Fill in the Template

#### Required Fields
- **full_name**: Full name of the member (e.g., "John Doe")
- **phone_number**: Phone number with country code (e.g., "+233 123 456 789" or "0244567890")
- **department_name**: One of the 12 department names (January - December)

#### Optional Fields
- **gender**: "Male" or "Female" (leave blank if unknown)

#### Important Notes
1. **Delete sample rows** (rows 2-4) before uploading
2. **Don't change column headers** (full_name, phone_number, gender, department_name)
3. Each row represents one member
4. Phone numbers must contain only: numbers, +, -, spaces, and ()
5. Department names must match exactly (see Departments sheet)
6. Maximum 500 members per upload

#### Example Data
```
full_name          | phone_number      | gender | department_name
-------------------|-------------------|--------|----------------
John Doe           | +233 123 456 789  | Male   | January
Jane Smith         | 0244567890        | Female | February
Robert Johnson     | +233 200 000 000  |        | March
```

### Step 4: Upload the File
1. Click the upload area or drag and drop your Excel file
2. The system will automatically:
   - Parse the Excel file
   - Validate all data
   - Show any errors found

### Step 5: Review Errors (if any)
If errors are found, the system will display:
- **Error count**: Total number of validation errors
- **Error table**: Detailed list showing:
  - Row number (matches Excel row)
  - Field name (which column has the error)
  - Error message (what's wrong)

**Common Errors:**
- "Full name is required" - Name field is empty
- "Phone number is required" - Phone field is empty
- "Invalid phone number format" - Phone contains invalid characters
- "Department is required" - Department field is empty
- "Invalid department" - Department name doesn't match the list
- "Gender must be either Male or Female" - Invalid gender value

**To Fix Errors:**
1. Open your Excel file
2. Go to the row number indicated
3. Fix the error
4. Save the file
5. Re-upload

### Step 6: Review Data
Once validation passes:
1. You'll see a preview table with all members
2. Each row shows a green "Valid" status
3. Review the data carefully
4. Click **"Register All Members"** to proceed
5. Or click **"Cancel"** to start over

### Step 7: Completion
After successful registration:
- You'll see the number of successfully registered members
- Any failures will be listed with reasons
- Options to:
  - **Register More Members**: Start a new bulk registration
  - **View All Members**: Go to the people list

## Validation Rules

### Full Name
- ✅ Required field
- ✅ Cannot be empty or just spaces
- ✅ Any characters allowed

### Phone Number
- ✅ Required field
- ✅ Cannot be empty
- ✅ Must contain only: 0-9, +, -, spaces, ()
- ✅ Examples of valid formats:
  - +233 123 456 789
  - 0244567890
  - +233-123-456-789
  - (233) 123 456 789

### Department Name
- ✅ Required field
- ✅ Must be exactly one of:
  - January, February, March, April, May, June
  - July, August, September, October, November, December
- ❌ Case-sensitive (must match exactly)
- ❌ No abbreviations (e.g., "Jan" is invalid)

### Gender (Optional)
- ✅ Can be blank/empty
- ✅ If provided, must be exactly "Male" or "Female"
- ❌ No abbreviations (e.g., "M" or "F" are invalid)

## Behind the Scenes

### What Happens During Registration
For each valid member, the system:
1. ✅ Creates a new record in `registered_people` table
2. ✅ Initializes all 15 progress stages (all uncompleted)
3. ✅ Assigns to the specified department
4. ✅ Makes them immediately available for tracking

### Progress Stage Initialization
All 15 stages are automatically created for each member:
1. Expressed Faith in Christ
2. Signed Membership Registration Form
3. Attended Water Baptism Class
4. Was Baptized
5. Joined a Life Group
6. ... (all 15 stages)

### Performance
- ⚡ Handles up to 500 members per upload
- ⚡ Validation is near-instant
- ⚡ Registration typically takes 5-30 seconds depending on count
- ⚡ Progress is shown during upload

## Troubleshooting

### "No data found in the file"
**Cause**: The Excel file is empty or has no data rows
**Solution**: Make sure you have data in rows 2 and onwards

### "Maximum 500 members allowed per upload"
**Cause**: Your file has more than 500 data rows
**Solution**: Split your data into multiple files of 500 or fewer

### "Error parsing file"
**Cause**: The file format is invalid or corrupted
**Solution**: 
- Make sure it's a valid Excel file (.xlsx or .xls)
- Try re-downloading the template and copying your data
- Don't modify the column structure

### "Invalid department"
**Cause**: Department name doesn't match exactly
**Solution**: 
- Check the Departments sheet in the template
- Copy department names directly from the template
- Ensure no extra spaces before/after the name

### "Failed to upload members"
**Cause**: Server error or network issue
**Solution**:
- Check your internet connection
- Verify you're logged in
- Try again in a few moments
- Contact support if issue persists

## Tips for Success

### 1. Use the Template
Always start with the downloaded template. Don't create your own from scratch.

### 2. Copy Department Names
Copy department names directly from the Departments sheet to avoid typos.

### 3. Clean Your Data First
Before importing:
- Remove duplicate phone numbers
- Standardize phone formats
- Check for spelling errors
- Verify department assignments

### 4. Test with Small Batches First
If you have hundreds of members:
- Start with 10-20 to test
- Once successful, upload the rest

### 5. Keep a Backup
Save a copy of your Excel file before uploading in case you need to reference it later.

### 6. Review Before Submitting
Always review the preview table carefully before clicking "Register All Members".

## Limitations

### Maximum Upload Size
- ❌ Maximum 500 members per upload
- ✅ Solution: Split into multiple batches

### Duplicate Detection
- ❌ System doesn't check for duplicate phone numbers
- ✅ Solution: Clean your data before upload

### No Undo
- ❌ Once registered, members cannot be bulk-deleted
- ✅ Solution: Review carefully before submitting

### File Formats
- ✅ Supported: .xlsx, .xls
- ❌ Not supported: .csv, .txt, .ods

## API Endpoint

### POST /api/people/bulk
Registers multiple members at once.

**Request:**
```json
{
  "people": [
    {
      "full_name": "John Doe",
      "phone_number": "+233 123 456 789",
      "gender": "Male",
      "department_name": "January"
    }
  ]
}
```

**Response (Success):**
```json
{
  "success": true,
  "inserted": 1,
  "failed": 0,
  "failedDetails": [],
  "people": [...]
}
```

**Response (Validation Error):**
```json
{
  "error": "Validation failed",
  "errors": [
    {
      "row": 2,
      "field": "phone_number",
      "message": "Phone number is required"
    }
  ],
  "validCount": 0,
  "totalCount": 1
}
```

## Frequently Asked Questions

### Q: Can I upload the same file twice?
**A:** Yes, but you'll create duplicate members. Clean duplicates before re-uploading.

### Q: What happens if some registrations fail?
**A:** Successfully registered members are saved. Failed ones are reported with reasons. You can fix and re-upload just the failed ones.

### Q: Can I edit members after bulk registration?
**A:** Currently, you need to edit them individually. Bulk editing is not yet available.

### Q: Does it send SMS to new members?
**A:** No, bulk registration doesn't automatically send SMS. Use the SMS feature separately if needed.

### Q: Are progress stages automatically tracked?
**A:** Yes, all 15 stages are initialized as "not completed" for each member.

### Q: Can I add custom fields?
**A:** No, only the template fields are supported. Additional fields are ignored.

### Q: What character encoding is supported?
**A:** UTF-8. Most international characters and names are supported.

### Q: Is there a size limit for the Excel file?
**A:** File size is typically not an issue. The 500-row limit is the main constraint.

## Support

If you encounter issues:
1. Check this guide first
2. Review the Instructions sheet in the template
3. Verify your data against the validation rules
4. Contact your system administrator

## Quick Reference

### Download Template
1. Click "Download Excel Template"
2. Save the file

### Fill Template
1. Delete sample rows
2. Fill in member data
3. Required: full_name, phone_number, department_name
4. Optional: gender

### Upload
1. Drag and drop or click to upload
2. Fix any validation errors
3. Review preview
4. Click "Register All Members"

### Success!
- Members are registered
- Progress stages initialized
- Ready for tracking
