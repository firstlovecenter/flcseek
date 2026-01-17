# Manual Year Rollover - Clone Previous Year Groups

## Overview

Groups are cloned manually through a simple UI button in the Groups Management page. This gives you complete control over when the cloning happens and allows you to review and manage the process for each of your production instances.

## How to Clone Groups

### Step 1: Go to Groups Management
1. Log in as **Superadmin**
2. Navigate to **Superadmin → Groups**

### Step 2: Click Clone Button
You'll see a button labeled **"Clone 2025 Groups"** (or whatever the previous year is)

Click this button to start the cloning process.

### Step 3: Confirm Action
A confirmation dialog will appear showing:
- How many groups will be cloned
- What year range (e.g., "from 2025 to 2026")
- Reminder that groups already existing in the target year will be skipped

Click **"Clone"** to proceed.

### Step 4: Review Results
After cloning completes, you'll see:
- ✅ Success message with count of cloned groups
- Number of skipped groups (if any already existed)
- Groups automatically refresh in the table

## What Gets Cloned

✅ **Group name** (e.g., "January", "September")  
✅ **Group description**  
✅ **Group leader** (same user assigned to new year group)  
✅ **Group structure** (recreates the same organization)

## What Does NOT Get Cloned

❌ **Converts/members** - New groups start with 0 members  
❌ **Attendance records** - Historical attendance stays with old year  
❌ **Milestone progress** - Members start fresh in new year groups  
❌ **Any historical data** - Completely clean slate for new year

## Example: Cloning from 2025 to 2026

**Before cloning:**
- 2025 groups: January, February, March... December (12 groups)
- 2026 groups: None

**After cloning:**
- 2025 groups: January, February, March... December (unchanged)
- 2026 groups: January, February, March... December (newly created)
- Leaders preserved: Same leader on September 2025 and September 2026

**Both years' groups:**
- Have their own members
- Have their own attendance tracking
- Have their own progress records
- Exist independently

## For Multiple Production Instances

If you have multiple instances (production US, EU, APAC, etc.), repeat the clone process on each instance:

1. Log into **Production US** → Superadmin → Groups → Clone button
2. Log into **Production EU** → Superadmin → Groups → Clone button
3. Log into **Production APAC** → Superadmin → Groups → Clone button

Or use the API endpoint directly if automating across instances (see below).

## API Endpoint (Advanced)

You can also trigger cloning programmatically:

```bash
curl -X POST https://your-instance.com/api/superadmin/groups/clone-previous-year \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "message": "Successfully cloned 12 groups from 2025 to 2026",
  "clonedCount": 12,
  "skippedCount": 0,
  "groups": [
    {
      "id": "...",
      "name": "January",
      "year": 2026,
      "leader_id": "...",
      "description": "..."
    }
    // ... more groups
  ]
}
```

## Duplicate Prevention

The system prevents duplicates with a unique constraint on (name, year). If you:
- Click the clone button multiple times
- Call the API multiple times
- Run on multiple instances

The system will skip groups that already exist and show the count of skipped items.

## Monitoring

Check the **Audit Logs** page (Superadmin → Activity Logs) to see:
- When groups were cloned
- Which groups were cloned
- Who triggered the cloning
- Timestamp of each action

## Troubleshooting

### "Clone button not visible"?
- Ensure you're logged in as **superadmin**
- Navigate to **Superadmin → Groups**
- The button shows the previous year automatically

### "Failed to clone groups"?
- Check your internet connection
- Verify the superadmin account has permission
- Check the Audit Logs for error details
- Try again in a few moments

### "Groups not appearing after cloning"?
- Refresh the page (Ctrl+R or Cmd+R)
- Check the year filter - groups are organized by year
- Verify the cloning completed successfully (check message)

### "Wrong groups created"?
- You can manually delete the incorrect groups before they're used
- Go to **Superadmin → Groups**, find the group, click Delete
- Click Clone again and verify

## When to Clone

**Recommended timing:**
- On or shortly after **January 1st** each year
- When you're ready to start accepting new members into the new year cohorts
- Before your first new intake/group creation for the year

**You decide when** - There's no automatic trigger. Manual cloning gives you control over the timing and process for each of your production instances.
