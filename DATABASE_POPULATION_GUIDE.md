# Database Population Guide - Sample Members

## Overview

This guide helps you populate your database with **120 realistic members** distributed evenly across all 12 departments. Each department will have 10 members with authentic Ghanaian names, locations, and contact details.

## What You're Getting

### 120 Members Total
- **10 members per department** (January through December)
- **Realistic Ghanaian names** (Akan, Ewe, Ga, Northern names)
- **Real locations** across Ghana (Accra, Kumasi, Takoradi, Tamale, etc.)
- **Home and work locations** for each member
- **Valid phone numbers** in Ghana format (+233244123xxx)
- **Gender diversity** (mixed male and female members)

### Geographic Distribution

| Department | Location Focus | Example Names |
|------------|----------------|---------------|
| January | Accra (Greater Accra) | Kwame Mensah, Akosua Owusu |
| February | Kumasi (Ashanti) | Nana Addo, Afua Nyarko |
| March | Takoradi (Western) | Emmanuel Aboagye, Elizabeth Mensah |
| April | Tamale (Northern) | Abdul Rahman, Fatima Mohammed |
| May | Cape Coast (Central) | Peter Gyamfi, Rebecca Buckman |
| June | Sunyani (Bono) | Richard Ofori, Linda Owusu-Ansah |
| July | Ho (Volta) | Thomas Addo, Priscilla Gadzekpo |
| August | Koforidua (Eastern) | William Oppong, Josephine Ofosuhene |
| September | Techiman (Bono East) | Christopher Owusu, Florence Antwi |
| October | Tarkwa (Western) | Henry Boateng, Bridget Amankwah |
| November | Wa (Upper West) | David Ansah, Lydia Seidu |
| December | Bolgatanga (Upper East) | Anthony Forson, Diana Ayambire |

## How to Populate

### Option 1: PowerShell Script (Recommended)

**Easiest method** - Automated with confirmation prompt:

```powershell
# In your project directory
.\scripts\populate-members.ps1
```

**What it does:**
1. ✓ Reads database URL from .env.local
2. ✓ Checks PostgreSQL client is installed
3. ✓ Shows you what will be added
4. ✓ Asks for confirmation
5. ✓ Runs the SQL script
6. ✓ Shows success message with breakdown

### Option 2: Direct SQL (psql)

If you have PostgreSQL client installed:

```powershell
# Set database URL
$env:DATABASE_URL = (Get-Content .env.local | Select-String "DATABASE_URL").ToString().Split('=')[1].Trim()

# Run SQL script
psql $env:DATABASE_URL -f scripts/populate-members.sql
```

### Option 3: Neon Console

If you don't have psql installed:

1. Go to https://console.neon.tech
2. Select your project
3. Click "SQL Editor"
4. Copy contents from `scripts/populate-members.sql`
5. Paste into editor
6. Click "Run"

### Option 4: Database Client

Using pgAdmin, DBeaver, or other clients:

1. Connect to your database
2. Open new SQL query window
3. Copy contents from `scripts/populate-members.sql`
4. Execute the query

## Sample Member Data

### Example Members from January Department

```
Name: Kwame Mensah
Phone: +233244123001
Gender: Male
Home: Achimota, Accra
Work: Osu, Accra
Department: January

Name: Akosua Owusu
Phone: +233244123002
Gender: Female
Home: Dansoman, Accra
Work: Makola, Accra
Department: January
```

### Example Members from April Department

```
Name: Abdul Rahman
Phone: +233244123033
Gender: Male
Home: Lamashegu, Tamale
Work: UDS, Tamale
Department: April

Name: Fatima Mohammed
Phone: +233244123034
Gender: Female
Home: Sagnarigu
Work: Tamale Metropolis
Department: April
```

## Phone Number Format

All phone numbers follow Ghana's mobile format:
- **Format:** +233244123XXX
- **Carrier:** MTN Ghana (244 prefix)
- **Sequence:** 001 through 120
- **Unique:** Each member has a unique number

## Locations Included

### Major Cities Covered
1. **Greater Accra:** Achimota, Dansoman, East Legon, Madina, Tema
2. **Ashanti (Kumasi):** Adum, Bantama, Asokwa, Tafo, KNUST area
3. **Western (Takoradi):** Market Circle, Sekondi, Kojokrom, Effiakuma
4. **Northern (Tamale):** Aboabo, Kalpohin, Lamashegu, Sagnarigu
5. **Central (Cape Coast):** UCC Campus, Pedu, Amamoma, Ewim
6. **And 7 more regions...**

Each member has:
- **Home Location:** Residential area with neighborhood
- **Work Location:** Workplace or business area

## What Happens When You Run It

### Step-by-Step Process

1. **Check for Admin User**
   - Script looks for a super_admin user
   - Uses that user as "registered_by" for all members

2. **Insert Members**
   - Adds 10 members to January department
   - Adds 10 members to February department
   - ... continues for all 12 departments
   - Total: 120 members

3. **Verify Count**
   - Runs a verification query
   - Shows member count per department
   - Confirms all members added successfully

### Expected Output

```sql
 department_name | member_count 
-----------------+--------------
 January         |           10
 February        |           10
 March           |           10
 April           |           10
 May             |           10
 June            |           10
 July            |           10
 August          |           10
 September       |           10
 October         |           10
 November        |           10
 December        |           10
(12 rows)
```

## After Population

### What You Can Do

1. **View Members in Dashboard**
   - Navigate to Super Admin dashboard
   - Click on any department
   - See all 10 members listed

2. **Track Progress**
   - Each member starts with 0/15 progress stages
   - Click on member to update progress
   - Mark stages as completed

3. **Record Attendance**
   - Click on any member
   - Go to Attendance tab
   - Add attendance records

4. **Test Bulk Operations**
   - Try bulk SMS features
   - Generate reports with real data
   - Test search and filter functions

## Important Notes

### ⚠️ Before Running

1. **Backup Your Database**
   ```bash
   pg_dump $DATABASE_URL > backup_before_population.sql
   ```

2. **Ensure You Have a Super Admin**
   - Script needs at least one super_admin user
   - This user will be set as "registered_by"
   - If you don't have one, create via registration

3. **Check Existing Data**
   - Script will ADD to existing members
   - It won't replace or delete existing data
   - Phone numbers might conflict if you have +233244123xxx numbers

### 🔄 Running Multiple Times

- Script is **idempotent-safe** for names
- Phone numbers are **NOT** checked for duplicates
- Running twice will add 240 members (120 each time)
- If you want fresh data, clean table first:
  ```sql
  DELETE FROM registered_people WHERE phone_number LIKE '+233244123%';
  ```

### 📝 Progress Stages

- Members are added **WITHOUT** progress records
- Progress records are created when you first view a member
- OR you can bulk initialize them separately

## Customization

### Modify the Script

Want to change member details? Edit `scripts/populate-members.sql`:

```sql
-- Change department assignment
('Kwame Mensah', '+233244123001', 'Male', 'Achimota, Accra', 'Osu, Accra', 'YOUR_DEPARTMENT'),

-- Add more members
('New Name', '+233244123121', 'Male', 'Location', 'Work', 'January'),

-- Change locations
('Same Name', 'Same Phone', 'Male', 'New Home', 'New Work', 'January'),
```

### Add More Departments

If you created custom departments:

```sql
INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
SELECT 
  full_name, phone_number, gender, home_location, work_location, 'YOUR_CUSTOM_DEPT',
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('Member 1', '+233244999001', 'Male', 'Location', 'Work'),
  ('Member 2', '+233244999002', 'Female', 'Location', 'Work')
) AS members(full_name, phone_number, gender, home_location, work_location);
```

## Troubleshooting

### Error: "psql: command not found"

**Problem:** PostgreSQL client not installed

**Solutions:**
1. Install PostgreSQL from https://www.postgresql.org/download/windows/
2. Use Neon Console (Option 3 above)
3. Use pgAdmin or DBeaver

### Error: "cannot find user with role super_admin"

**Problem:** No super admin user exists

**Solution:** Create a super admin first:
```sql
INSERT INTO users (username, password, phone_number, role)
VALUES ('admin', '$2b$10$[your_hashed_password]', '+233244000000', 'super_admin');
```

Or register via the UI at `/api/auth/register`

### Error: "duplicate key value violates unique constraint"

**Problem:** Phone numbers already exist

**Solutions:**
1. Change phone number sequence in SQL file
2. Delete existing members with those numbers
3. Use different phone number range

### Members Not Showing in Department

**Problem:** Department names don't match

**Solution:** Ensure department names in SQL match exactly:
- Case-sensitive: "January" not "january"
- No extra spaces
- Check your departments table

## Verification Queries

After population, verify with these queries:

### Count Members Per Department
```sql
SELECT department_name, COUNT(*) as member_count 
FROM registered_people 
GROUP BY department_name 
ORDER BY department_name;
```

### View Sample Members
```sql
SELECT full_name, phone_number, department_name, home_location
FROM registered_people
LIMIT 10;
```

### Check Specific Department
```sql
SELECT full_name, gender, phone_number
FROM registered_people
WHERE department_name = 'January'
ORDER BY full_name;
```

### Total Members
```sql
SELECT COUNT(*) as total_members FROM registered_people;
```

## Clean Up (If Needed)

### Remove All Populated Members
```sql
DELETE FROM registered_people 
WHERE phone_number LIKE '+233244123%';
```

### Remove Specific Department
```sql
DELETE FROM registered_people 
WHERE department_name = 'January' 
  AND phone_number LIKE '+233244123%';
```

### Start Fresh (All Members)
```sql
TRUNCATE TABLE registered_people CASCADE;
```
⚠️ **Warning:** This deletes ALL members and related records!

## Next Steps

After populating members:

1. ✅ **Initialize Progress Stages**
   - Run progress initialization if needed
   - Each member needs 15 progress records

2. ✅ **Add Sample Attendance**
   - Add some attendance records for realism
   - Test attendance tracking features

3. ✅ **Test SMS Features**
   - Try sending SMS to these members
   - Test bulk SMS functionality

4. ✅ **Generate Reports**
   - Run progress reports
   - View attendance statistics
   - Test department summaries

5. ✅ **Update Member Details**
   - Test edit functionality
   - Try updating locations
   - Modify member information

## Summary

**What You Get:**
- 120 realistic members
- 10 per department
- Ghanaian names and locations
- Ready for testing all features

**How to Run:**
```powershell
.\scripts\populate-members.ps1
```

**Time:** ~5 seconds to complete

**Reversible:** Yes, can delete by phone number pattern

---

**Ready to populate?** Run the script and watch your database come to life! 🎉
