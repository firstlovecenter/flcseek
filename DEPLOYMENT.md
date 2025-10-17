# Deployment Guide - FLC Sheep Seeking

## Deploying to Netlify

This application requires server-side rendering for API routes, so we'll use Netlify Functions.

### Step 1: Prepare Your Repository

1. Push your code to GitHub, GitLab, or Bitbucket
2. Make sure all files are committed

### Step 2: Connect to Netlify

1. Log in to [Netlify](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Choose your Git provider and select your repository
4. Configure build settings:

```
Build command: npm run build
Publish directory: .next
```

### Step 3: Configure Environment Variables

In Netlify, go to Site settings → Environment variables and add:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET=your_secure_random_string
MNOTIFY_API_KEY=your_mnotify_api_key
MNOTIFY_SENDER_ID=FLC
```

### Step 4: Enable Netlify Functions

Netlify will automatically detect Next.js and enable Functions. No additional configuration needed!

### Step 5: Deploy

Click "Deploy site" and wait for the build to complete.

## Important Notes

### Database Setup
Before deploying, make sure you've:
1. Executed the SQL migration in your Supabase dashboard
2. Created at least one Super Admin user
3. Tested the connection locally

### Security Checklist
- [ ] Changed default admin password
- [ ] Set a strong JWT_SECRET (not the default one)
- [ ] Enabled RLS policies in Supabase
- [ ] Verified API keys are not exposed in frontend code
- [ ] Tested all authentication flows

### Post-Deployment Testing

After deployment, test:
1. Login functionality
2. Creating users (Super Admin)
3. Registering people (Sheep Seekers)
4. Progress tracking
5. Attendance recording
6. SMS notifications (if mNotify is configured)

## Troubleshooting

### Build Fails
- Check that all environment variables are set
- Verify Node.js version is 18+
- Review build logs for specific errors

### API Routes Not Working
- Ensure Netlify Functions are enabled
- Check that `next.config.js` doesn't have `output: 'export'`
- Verify environment variables are accessible

### Database Connection Issues
- Confirm Supabase URL and keys are correct
- Check Supabase project status
- Verify RLS policies are properly configured

### SMS Not Sending
- Confirm mNotify API key is valid
- Check SMS logs in Supabase dashboard
- Verify phone numbers are in correct format

## Alternative: Deploy to Vercel

This app can also be deployed to Vercel:

```bash
npx vercel
```

Follow the prompts and set the same environment variables in Vercel dashboard.

## Monitoring

After deployment, monitor:
- Server logs in Netlify dashboard
- Database queries in Supabase dashboard
- SMS delivery status in mNotify dashboard
- Error rates and performance metrics

## Updating the Application

To deploy updates:
1. Push changes to your Git repository
2. Netlify will automatically rebuild and deploy
3. No downtime during deployment

## Backup Strategy

Regular backups are critical:
1. **Database**: Use Supabase's automatic daily backups
2. **Code**: Keep Git repository up to date
3. **Environment Variables**: Document all variables securely

## Support

For deployment issues:
1. Check Netlify build logs
2. Review Supabase logs
3. Verify all environment variables
4. Test locally first before deploying

---

**Production Checklist:**
- [ ] Database migration executed
- [ ] Environment variables configured
- [ ] Default credentials changed
- [ ] SMS service tested
- [ ] Authentication tested
- [ ] All API routes working
- [ ] Mobile responsive design verified
- [ ] Performance optimized
