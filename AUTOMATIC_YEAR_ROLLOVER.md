# Automatic Year Rollover Setup - GitHub Actions (Multiple Instances)

## Overview
The system automatically clones all groups from the previous year to the current year on January 1st at midnight UTC across **all production instances**. This uses GitHub Actions matrix strategy to run the cloning job in parallel across multiple deployments.

## Features
- ✅ Clones all active groups across **multiple production instances**
- ✅ Runs in parallel for efficiency (max 2 at a time to avoid overload)
- ✅ Preserves group leaders and descriptions on all instances
- ✅ Skips groups that already exist in current year
- ✅ Logs all cloning actions in audit trail
- ✅ Can be triggered manually via GitHub Actions or UI button
- ✅ Easily add/remove instances without code changes
- ✅ Starts new year groups with 0 members (converts not auto-migrated)

## How It Works

### Manual Trigger (Superadmin UI)
1. Go to **Superadmin → Groups**
2. Click **"Clone 2025 Groups"** button (shows previous year)
3. Confirm the action
4. System clones all groups and shows count of cloned/skipped groups

### Automatic Trigger (January 1st)
The system needs to call the clone endpoint on January 1st. Since Next.js runs on serverless infrastructure, you need to set up an external cron service.

## Setup Options

### GitHub Actions Setup (Multiple Production Instances)

The workflow is already configured at `.github/workflows/yearly-rollover.yml` with **matrix strategy** to run across all production instances.

#### Step 1: Generate Automation Token

Run this command locally to generate a long-lived superadmin token:

```bash
npx tsx scripts/generate-automation-token.ts
```

This will output a token and setup instructions.

#### Step 2: Add GitHub Secrets

1. Go to: **GitHub Repository → Settings → Secrets and variables → Actions**
2. Click **"New repository secret"**
3. Add **two secrets**:

**Secret 1: SUPERADMIN_TOKEN**
- Name: `SUPERADMIN_TOKEN`
- Value: (paste the token from Step 1)

**Secret 2: PRODUCTION_INSTANCES**
- Name: `PRODUCTION_INSTANCES`
- Value: JSON array with your instances (see below)

#### Step 3: Configure Production Instances

In the **PRODUCTION_INSTANCES** secret, paste your instances as JSON:

```json
[
  {"name": "Production US", "url": "https://prod-us.flcseek.com"},
  {"name": "Production EU", "url": "https://prod-eu.flcseek.com"},
  {"name": "Production APAC", "url": "https://prod-apac.flcseek.com"}
]
```

**Rules:**
- Must be valid JSON array format
- Each instance must have `name` (for logs) and `url` (endpoint)
- URLs must NOT have trailing slashes
- All instances must be accessible from GitHub Actions runners
- All instances use the same SUPERADMIN_TOKEN

#### Step 4: Verify and Test

1. Push your code to GitHub
2. Go to **Repository → Actions → Yearly Group Rollover**
3. Click **"Run workflow"** to test immediately
4. Watch as it runs the clone job for each instance in parallel

#### What to Expect

When the workflow runs, you'll see:
- One job per production instance (running in parallel, max 2 at a time)
- Each job logs the instance name, URL, and result
- Failures in one instance don't block others
- Total time ≈ (number_of_instances ÷ 2) × network_latency

Example workflow output:
```
✅ Clone Groups to New Year - Production US
✅ Clone Groups to New Year - Production EU  
✅ Clone Groups to New Year - Production APAC
```

## API Endpoint Reference

### Clone Previous Year Groups
```
POST /api/superadmin/groups/clone-previous-year
Authorization: Bearer <superadmin_token>
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
      "description": "...",
      "leader_id": "...",
      "created_at": "2026-01-01T00:00:00Z"
    }
    // ... more groups
  ]
}

## What Gets Cloned
- Group name (e.g., "September")
- Group description
- Group leader (same user assigned to new year group)
- Archived status (only active groups cloned)

## What Does NOT Get Cloned
- ❌ Converts/members (new groups start with 0 members)
- ❌ Attendance records
- ❌ Milestone progress
- ❌ Historical data

Each new year's groups are clean slates, building on the structure from the previous year.

## Audit Trail
All group cloning is logged in the audit trail with:
- Action: `GROUP_CLONED`
- Source year and target year
- Group name and leader ID
- Timestamp and user who triggered the action (for manual triggers)

## Troubleshooting

### Workflow shows in Actions tab but didn't run on January 1st?
1. The workflow file needs to be in the `main` branch
2. GitHub schedules cron jobs with some variance (usually runs within 15 minutes)
3. Check **Actions → Yearly Group Rollover** to see if it ran

### One instance failed, but others succeeded?
- This is expected - the workflow has `fail-fast: false`
- Other instances continue running and cloning their groups
- Fix the failing instance and manually re-run the workflow

### "401 Unauthorized" on some instances?
- Token may have expired (lasts 1 year)
- Or the instance's JWT_SECRET doesn't match the token
- Verify all instances use the same JWT_SECRET

### "Connection refused" or "Could not resolve host"?
- Instance URL is incorrect or instance is down
- Verify the URL is accessible from the internet
- Remove problematic instances from PRODUCTION_INSTANCES and re-run

### How to add/remove instances?
1. Edit the PRODUCTION_INSTANCES secret in GitHub
2. Add or remove instances from the JSON array
3. No code changes needed!
4. Next run will use the updated list

### Manual trigger before January 1st?
1. Go to **Repository → Actions → Yearly Group Rollover**
2. Click **"Run workflow"** button
3. Workflow runs immediately across all instances
4. Check logs for results

## Monitoring
After setting up GitHub Actions:
1. Go to **Repository → Actions → Yearly Group Rollover**
2. You'll see a list of all workflow runs with dates and statuses
3. Click any run to see detailed logs for each instance
4. The workflow shows which instances succeeded/failed
5. Check the Audit Logs page in **each instance** to verify cloning operations

## Duplicate Prevention
The system prevents duplicates with a unique constraint on (name, year). If you:
- Manually run the workflow multiple times
- Manually click "Clone Groups" in the UI on multiple instances
- Or any combination

The second attempt will simply skip any groups that already exist, showing them in the skipped count.

## Token Expiration & Renewal
The automation token is valid for **1 year** from generation.

**Before it expires (around January 1st next year):**
1. Run: `npx tsx scripts/generate-automation-token.ts`
2. Copy the new token
3. Update the `SUPERADMIN_TOKEN` secret in GitHub
4. Save - No code changes needed!

## Example: Adding a 4th Production Instance

1. Go to **Settings → Secrets and variables → Actions**
2. Click on `PRODUCTION_INSTANCES`
3. Edit the value and add your new instance:

```json
[
  {"name": "Production US", "url": "https://prod-us.flcseek.com"},
  {"name": "Production EU", "url": "https://prod-eu.flcseek.com"},
  {"name": "Production APAC", "url": "https://prod-apac.flcseek.com"},
  {"name": "Production India", "url": "https://prod-india.flcseek.com"}
]
```

4. Save
5. Next workflow run will include the new instance automatically!
