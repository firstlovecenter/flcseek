# Multi-Instance Setup Checklist

## Quick Setup for Multiple Production Instances

### 1️⃣ Generate Token
```bash
npx tsx scripts/generate-automation-token.ts
```
Copy the output token.

### 2️⃣ Add GitHub Secrets
Go to: `Settings → Secrets and variables → Actions`

Create two secrets:

**Secret A: SUPERADMIN_TOKEN**
```
Value: (paste the token from Step 1)
```

**Secret B: PRODUCTION_INSTANCES**
```json
[
  {"name": "Production US", "url": "https://prod-us.flcseek.com"},
  {"name": "Production EU", "url": "https://prod-eu.flcseek.com"},
  {"name": "Production APAC", "url": "https://prod-apac.flcseek.com"}
]
```

### 3️⃣ Test the Workflow

- Push code to GitHub
- Go to: `Actions → Yearly Group Rollover`
- Click: **"Run workflow"** to test immediately

### ✅ Done!

The workflow will now:
- Run **automatically on January 1st** at midnight UTC
- Clone groups on **all production instances in parallel**
- Show individual results for each instance
- Continue even if one instance fails

### 📌 Key Points

| Item | Details |
|------|---------|
| **Execution** | January 1st at 00:00 UTC (or manual trigger) |
| **Parallelization** | Max 2 instances at a time |
| **Failure handling** | One failure doesn't block others |
| **Token validity** | 1 year from generation |
| **Add new instance** | Just edit PRODUCTION_INSTANCES secret |

### 🔧 Common Tasks

**Test anytime:**
```
Actions → Yearly Group Rollover → Run workflow
```

**Add a new instance:**
1. Edit PRODUCTION_INSTANCES secret in GitHub
2. Add your new instance to JSON array
3. Done! (No code changes needed)

**Regenerate token (after 1 year):**
```bash
npx tsx scripts/generate-automation-token.ts
```
Then update SUPERADMIN_TOKEN secret.

### 📋 Files Updated

- `.github/workflows/yearly-rollover.yml` - Matrix strategy for multiple instances
- `scripts/generate-automation-token.ts` - Token generation with multi-instance docs
- `AUTOMATIC_YEAR_ROLLOVER.md` - Full setup and troubleshooting guide
- `app/superadmin/groups/page.tsx` - Manual clone button in UI
- `app/api/superadmin/groups/clone-previous-year/route.ts` - Clone API endpoint
