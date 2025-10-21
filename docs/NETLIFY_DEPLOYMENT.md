# Netlify Deployment Guide for FLC Sheep Seeking App

## Prerequisites

1. GitHub account with the repository
2. Netlify account
3. Neon database (serverless PostgreSQL)

## Environment Variables Required

Before deploying to Netlify, you need to set up the following environment variables in your Netlify dashboard:

### Required Variables:

1. **NEON_DATABASE_URL**
   - Your Neon database connection string
   - Format: `postgresql://username:password@host/database?sslmode=require`
   - Get this from your Neon dashboard

2. **JWT_SECRET**
   - A secure secret for JWT token signing
   - Use a strong random string (minimum 32 characters)
   - Example: Generate with `openssl rand -base64 32`

## Netlify Setup Steps

### 1. Connect Repository to Netlify

1. Log in to [Netlify](https://netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **"Deploy with GitHub"**
4. Select the `flcseek` repository
5. Authorize Netlify to access your GitHub repository

### 2. Configure Build Settings

In the Netlify dashboard, configure the following:

**Build settings:**
- **Base directory:** (leave empty)
- **Build command:** `npm run build`
- **Publish directory:** `.next`
- **Functions directory:** (leave empty)

**Advanced settings:**
- Node version: `18.x` or higher

### 3. Add Environment Variables

1. Go to **Site settings** → **Environment variables**
2. Click **"Add a variable"**
3. Add each variable:

```
Key: NEON_DATABASE_URL
Value: postgresql://neondb_owner:YOUR_PASSWORD@YOUR_HOST.neon.tech/neondb?sslmode=require
```

```
Key: JWT_SECRET
Value: YOUR_SECURE_JWT_SECRET_HERE
```

### 4. Deploy

1. Click **"Deploy site"**
2. Wait for the build to complete (usually 2-5 minutes)
3. Once deployed, Netlify will provide a URL like: `https://your-app-name.netlify.app`

## Post-Deployment Steps

### 1. Database Setup

If this is your first deployment, you need to run database migrations:

1. Visit: `https://your-app-name.netlify.app/run-migrations.html`
2. Enter your `NEON_DATABASE_URL`
3. Click "Run Migrations"
4. Wait for success message

### 2. Create Super Admin User

You have two options:

**Option A: Using the UI**
1. Visit: `https://your-app-name.netlify.app/`
2. Click "Register" (first-time only)
3. Create your super admin account

**Option B: Direct Database Insert**
Use the Neon SQL Editor to insert a super admin user directly.

### 3. Populate Initial Data (Optional)

Visit: `https://your-app-name.netlify.app/populate-database.html`
- Enter your credentials
- This will create sample groups and test data

## Troubleshooting

### Build Fails

**Issue:** "Failed to fetch cache, continuing with build"
- **Solution:** This is normal, not an error. Netlify is just notifying that it's doing a fresh build.

**Issue:** "Module not found" errors
- **Solution:** Ensure all dependencies are in `package.json` and committed to git
- Run `npm install` locally to verify

**Issue:** "Environment variable not defined"
- **Solution:** Double-check that all environment variables are set in Netlify dashboard
- Variables must match exactly (case-sensitive)

### Runtime Errors

**Issue:** Database connection fails
- **Solution:** Verify `NEON_DATABASE_URL` is correct
- Check Neon dashboard to ensure database is active
- Ensure connection string includes `?sslmode=require`

**Issue:** JWT token errors
- **Solution:** Ensure `JWT_SECRET` is set and is at least 32 characters

**Issue:** 404 errors on pages
- **Solution:** This is a Next.js app using App Router, ensure build completed successfully
- Check that publish directory is set to `.next`

### Deploy from Branch

To deploy from a specific branch:
1. Go to **Site settings** → **Build & deploy** → **Deploy contexts**
2. Choose which branches to deploy
3. Save changes

### Custom Domain

To use a custom domain:
1. Go to **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Follow the DNS configuration instructions

## Continuous Deployment

Netlify automatically deploys when you push to your main branch:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

Netlify will automatically:
1. Detect the push
2. Start a new build
3. Deploy if build succeeds
4. Send you a notification

## Environment-Specific Builds

### Production vs Preview

- **Production:** Deploys from `main` branch
- **Preview:** Deploys from pull requests or other branches

Each can have different environment variables if needed.

## Performance Optimization

### Enable CDN
Netlify automatically enables CDN for static assets.

### Enable Edge Functions (Optional)
For better performance, consider enabling Netlify Edge Functions.

### Cache Settings
Netlify handles caching automatically, but you can customize in `netlify.toml` if needed.

## Monitoring

### Build Logs
- View in **Deploys** tab
- Shows real-time build progress
- Helpful for debugging

### Function Logs
- View in **Functions** tab
- Shows API route execution logs

### Analytics (Optional)
Enable Netlify Analytics in **Site settings** for traffic insights.

## Security Best Practices

1. **Never commit `.env` file** - Already in `.gitignore`
2. **Use strong JWT_SECRET** - Minimum 32 random characters
3. **Regularly rotate secrets** - Update in Netlify dashboard
4. **Enable HTTPS** - Netlify provides this automatically
5. **Monitor access logs** - Check for suspicious activity

## Useful Commands

```bash
# Test build locally
npm run build

# Check for TypeScript errors
npm run typecheck

# Run linter
npm run lint

# Start production server locally
npm run start
```

## Support

For issues specific to:
- **Netlify deployment:** [Netlify Support](https://www.netlify.com/support/)
- **Neon database:** [Neon Docs](https://neon.tech/docs)
- **Next.js:** [Next.js Docs](https://nextjs.org/docs)

## Deployment Checklist

- [ ] Repository pushed to GitHub
- [ ] Netlify account created
- [ ] Repository connected to Netlify
- [ ] Build settings configured
- [ ] Environment variables added
- [ ] First deployment triggered
- [ ] Database migrations run
- [ ] Super admin user created
- [ ] Application tested in production
- [ ] Custom domain configured (optional)

## Quick Reference

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Publish directory | `.next` |
| Node version | `18.x` or higher |
| Environment variables | `NEON_DATABASE_URL`, `JWT_SECRET` |

---

**Need Help?** Check the build logs in Netlify dashboard for specific error messages.
