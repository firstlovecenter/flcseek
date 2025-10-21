# 🔧 Database Setup - Quick Fix

## The Issue

The database columns `home_location` and `work_location` don't exist yet. They need to be added via migration before populating data.

## ✅ Two-Step Solution

### Step 1: Run Migrations First

1. **Make sure dev server is running**:
   ```powershell
   npm run dev
   ```

2. **Visit the migration page**:
   ```
   http://localhost:3000/run-migrations.html
   ```

3. **Click "Run Migrations"** button

4. **Wait for success message** ✅

### Step 2: Populate Database

1. **After migrations complete**, click "Go to Populate Page"

2. **Or visit directly**:
   ```
   http://localhost:3000/populate-database.html
   ```

3. **Click "Populate Database Now"**

4. **Wait for 120 members to be added** 🎉

---

## What Each Step Does

### Migrations (Step 1)
- ✅ Adds `home_location` column to `registered_people` table
- ✅ Adds `work_location` column to `registered_people` table
- ⏱️ Takes ~2 seconds

### Population (Step 2)
- ✅ Adds 120 members across 12 departments
- ✅ Includes realistic Ghanaian names and locations
- ⏱️ Takes ~10 seconds

---

## Alternative: Use Neon Console

If the web interface doesn't work:

1. **Go to** https://console.neon.tech
2. **Select your project**
3. **Click "SQL Editor"**
4. **Run migration first**:
   ```sql
   ALTER TABLE registered_people 
   ADD COLUMN IF NOT EXISTS home_location text,
   ADD COLUMN IF NOT EXISTS work_location text;
   ```
5. **Then copy/paste from** `scripts/populate-members.sql`

---

## Quick Commands

```powershell
# Start server if not running
npm run dev

# Then visit:
# http://localhost:3000/run-migrations.html
```

---

## Files Created

1. **`public/run-migrations.html`** - Web UI to run migrations
2. **`app/api/run-migrations/route.ts`** - API endpoint for migrations
3. **`public/populate-database.html`** - Web UI to populate (already exists)
4. **`app/api/populate/route.ts`** - API endpoint to populate (already exists)

---

**Run migrations first, then populate!** 🚀
