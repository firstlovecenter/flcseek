# 🚀 Quick Fix: Populate Database with Sample Members

## The Issue

You don't see populated data because the database population script hasn't been run yet.

## ✅ Solution (Easy Way)

### Option 1: Use the Web Interface (Easiest!)

1. **Start your dev server** (if not already running):
   ```powershell
   npm run dev
   ```

2. **Visit the populate page**:
   ```
   http://localhost:3000/populate-database.html
   ```

3. **Click the button** "Populate Database Now"

4. **Wait** ~10 seconds while 120 members are added

5. **Done!** You'll see a success message with counts

6. **View results** by going to your dashboard

---

### Option 2: Use the API Directly

If you prefer command line:

1. **Start your dev server**:
   ```powershell
   npm run dev
   ```

2. **In another PowerShell window**, run:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3000/api/populate" -Method POST | ConvertTo-Json
   ```

3. **Check the response** - you should see success message

---

## What Gets Added

When you run the populate script, it adds:

- **120 total members**
- **10 members per department** (January through December)
- **Realistic Ghanaian names** (Kwame, Akosua, Nana, etc.)
- **Real locations** across Ghana:
  - January: Accra region
  - February: Kumasi region
  - March: Takoradi region
  - April: Tamale region
  - May: Cape Coast region
  - June: Sunyani region
  - July: Ho region
  - August: Koforidua region
  - September: Techiman region
  - October: Tarkwa region
  - November: Wa region
  - December: Bolgatanga region
- **Phone numbers**: +233244123001 through +233244123120
- **Home and work locations** for each member
- **Gender distribution**

---

## Verify Population

### Check Super Admin Dashboard

1. Login to your app
2. Go to Super Admin dashboard
3. You should now see member counts for each department
4. Click on any department to see the 10 members

### Check via API

```powershell
# Get total count
Invoke-RestMethod -Uri "http://localhost:3000/api/people" -Headers @{"Authorization"="Bearer YOUR_TOKEN"}

# Or check specific department
Invoke-RestMethod -Uri "http://localhost:3000/api/people?department=January" -Headers @{"Authorization"="Bearer YOUR_TOKEN"}
```

---

## Troubleshooting

### "No super admin user found"

**Problem:** You need at least one super admin user before populating.

**Solution:** Register a super admin first:
1. Go to registration page
2. Create a user with role "super_admin"
3. Then run the populate script

### "Already populated"

**Problem:** Members already exist (duplicate phone numbers).

**Solution:** This is fine! The script skips duplicates. The message will say how many were added vs skipped.

### "Server not running"

**Problem:** Dev server isn't started.

**Solution:**
```powershell
npm run dev
```
Then try again.

### "Cannot find module"

**Problem:** Dependencies missing.

**Solution:**
```powershell
npm install --legacy-peer-deps
```

---

## Alternative: Manual SQL Population

If the web interface doesn't work, you can use Neon Console:

1. Go to https://console.neon.tech
2. Select your project
3. Click "SQL Editor"
4. Copy contents from `scripts/populate-members.sql`
5. Paste and click "Run"

---

## After Population

Once populated, you can:

✅ **View all members** in department dashboards  
✅ **Track progress** for each member  
✅ **Record attendance**  
✅ **Send bulk SMS** to departments  
✅ **Generate reports**  
✅ **Test search and filter** features  

---

## Files Created

To help you populate the database, I created:

1. **`public/populate-database.html`** - Web interface to populate
2. **`app/api/populate/route.ts`** - API endpoint for population
3. **`scripts/populate-members.ts`** - TypeScript population script
4. **`scripts/populate-members.sql`** - Original SQL file
5. **`scripts/populate-members.ps1`** - PowerShell script

Use whichever method works best for you!

---

## Quick Start Commands

```powershell
# 1. Start dev server
npm run dev

# 2. In browser, visit:
# http://localhost:3000/populate-database.html

# 3. Click "Populate Database Now"

# 4. Done! Check your dashboard
```

---

**That's it!** Your database will be populated with 120 realistic members ready for testing. 🎉
