# FLCSeek Setup Guide for New Organizations

This guide will help you fork and deploy FLCSeek for your church or organization with the exact same database structure and functionality.

## 📋 Prerequisites

Before you begin, ensure you have:

- ✅ Node.js 18+ installed ([Download](https://nodejs.org/))
- ✅ Git installed ([Download](https://git-scm.com/))
- ✅ PostgreSQL client (`psql`) installed ([Instructions below](#installing-postgresql-client))
- ✅ A GitHub account (for forking)
- ✅ A Neon Database account (free tier available at [neon.tech](https://neon.tech))

## 🍴 Step 1: Fork the Repository

1. Go to https://github.com/firstlovecenter/flcseek
2. Click the **Fork** button in the top right
3. Clone your forked repository:

```bash
git clone https://github.com/YOUR_USERNAME/flcseek.git
cd flcseek
```

## 📦 Step 2: Install Dependencies

```bash
npm install
```

This will install all required Node.js packages including:
- Next.js 13
- Ant Design
- TypeScript
- Tailwind CSS
- Database drivers
- And more...

## 🗄️ Step 3: Set Up Your Database

### 3.1 Create Neon Database

1. Visit [neon.tech](https://neon.tech) and sign up for a free account
2. Click **"Create Project"**
3. Choose:
   - **Project Name:** Your church name (e.g., "Grace Church Converts")
   - **Region:** Choose closest to your location
   - **PostgreSQL Version:** 15 or latest
4. Click **"Create Project"**
5. Copy your connection string from the dashboard

Your connection string will look like:
```
postgresql://username:password@ep-random-id-123456.us-east-2.aws.neon.tech/dbname?sslmode=require
```

### 3.2 Configure Environment Variables

Create a file named `.env.local` in the root directory of your project:

```bash
# In the flcseek folder, create .env.local
touch .env.local  # Mac/Linux
# OR
New-Item .env.local  # Windows PowerShell
```

Add the following content to `.env.local`:

```env
# Database Connection (REQUIRED)
# Replace with your Neon connection string
NEON_DATABASE_URL=postgresql://username:password@ep-your-project.region.aws.neon.tech/dbname?sslmode=require

# JWT Secret for Authentication (REQUIRED)
# Generate a secure random string - NEVER share this publicly!
JWT_SECRET=your-super-secret-random-string-min-32-characters-long
```

**🔐 Generate a secure JWT_SECRET:**

```bash
# Option 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: OpenSSL
openssl rand -hex 32

# Option 3: Online generator (be cautious!)
# Visit: https://www.random.org/strings/
```

**⚠️ IMPORTANT SECURITY NOTES:**
- Never commit `.env.local` to Git (it's already in `.gitignore`)
- Use different JWT_SECRET for production vs development
- Store production secrets in deployment platform (Netlify/Vercel)

### 3.3 Run Database Migration

This single command will create all tables, indexes, and seed data:

```bash
npm run db:setup
```

**What this creates:**
- ✅ 6 database tables with proper relationships
- ✅ 15+ performance indexes for fast queries
- ✅ Default superadmin account (username: `superadmin`, password: `admin123`)
- ✅ 18 pre-configured spiritual growth milestones
- ✅ 12 month groups for current year (2025)
- ✅ Foreign key constraints for data integrity

**Expected output:**
```
🚀 Starting FLCSeek Database Setup...

📁 Migration file: /path/to/db/migrations/000_initial_setup.sql
🔗 Database URL: postgresql://username:****@host.neon.tech/db

✅ PostgreSQL client found, running migration...

NOTICE:  =============================================================================
NOTICE:  FLCSeek Database Setup Complete!
...

✅ Database setup complete!

Next steps:
  1. Run: npm run dev
  2. Visit: http://localhost:3000
  3. Login with username: superadmin, password: admin123
  4. Change superadmin password immediately!
```

### 3.4 Troubleshooting Database Setup

**Problem: `psql: command not found`**

You need to install PostgreSQL client tools. See [Installing PostgreSQL Client](#installing-postgresql-client) below.

**Alternative: Run migration via Neon Dashboard**
1. Go to https://console.neon.tech
2. Select your project
3. Click **SQL Editor** in the sidebar
4. Open `db/migrations/000_initial_setup.sql` from your project
5. Copy the entire contents
6. Paste into SQL Editor
7. Click **Run** button

---

**Problem: `FATAL: password authentication failed`**

Check your connection string in `.env.local`:
- Ensure URL is copied correctly from Neon dashboard
- Check for extra spaces or missing characters
- Verify `?sslmode=require` is at the end

---

**Problem: `database "dbname" does not exist`**

Neon creates a default database. Use the exact connection string from Neon dashboard without modifying the database name.

---

## 🚀 Step 4: Run the Application

Start the development server:

```bash
npm run dev
```

Open your browser and visit: **http://localhost:3000**

### First Login
- **Username:** `superadmin`
- **Password:** `admin123`
- **Role:** Super Administrator (full system access)

**🔒 IMPORTANT: Change the superadmin password immediately!**
1. After logging in, go to **Super Admin** → **Users**
2. Click on **superadmin** user
3. Click **Edit**
4. Set a strong new password
5. Save changes

## 🎨 Step 5: Customize for Your Organization

### 5.1 Update Branding

**Application Name & Title:**

Edit `app/layout.tsx`:
```typescript
export const metadata: Metadata = {
  title: 'Your Church Name - Convert Tracking',  // Change this
  description: 'Track new convert spiritual growth and attendance',
  // ... other settings
};
```

**PWA Manifest (App Name):**

Edit `public/manifest.json`:
```json
{
  "name": "Your Church Name Converts",  // Full name
  "short_name": "YCN Converts",  // Short name (max 12 chars)
  "description": "Track spiritual growth of new converts",
  // ... rest of manifest
}
```

**Theme Colors:**

Edit `app/globals.css` to change brand colors:
```css
:root {
  --primary: 0 52 102;  /* Your primary color in RGB */
  --primary-hover: 0 71 142;
  /* ... other color variables */
}
```

### 5.2 Customize Milestones

1. Login as **admin**
2. Go to **Super Admin** → **Milestones**
3. You can:
   - Edit existing milestone names
   - Change milestone descriptions
   - Add new milestones (stage number 19+)
   - Reorder by changing stage numbers

**Default 18 Milestones:**
1. First Attendance
2. Foundation Class
3. Connect Group
4. Baptism
5. Membership Class
6. Church Member
7. Volunteer Service
8. Regular Giver
9. Soul Winner
10. Bible Study
11. Prayer Meeting
12. Leadership Training
13. Mentor Assigned
14. Scripture Memory
15. Ministry Team
16. Evangelism
17. Spiritual Gifts
18. Mature Believer

### 5.3 Configure Groups (Months)

The system comes with 12 groups for 2025 (January - December).

**To add groups for 2026:**
1. Go to **Super Admin** → **Groups**
2. Click **Create Group**
3. Enter:
   - Name: `January`
   - Year: `2026`
   - Description: `New converts registered in January 2026`
4. Repeat for all 12 months

### 5.4 Create User Accounts

**Create Month Leaders (Admins):**
1. **Super Admin** → **Users** → **Create User**
2. Fill in:
   - Username
   - Password
   - Role: **Admin**
   - Assign to Group: Select month (e.g., "January 2025")
3. Provide credentials to the month leader

**Create Sheep Seekers (Leaders):**
1. **Super Admin** → **Users** → **Create User**
2. Fill in:
   - Username
   - Password
   - Role: **Leader**
   - Assign to Group: Select month
3. Provide credentials to the sheep seeker

## 📱 Step 6: Deploy to Production

### Option A: Deploy to Netlify (Recommended)

**Why Netlify?**
- ✅ Free tier available
- ✅ Automatic HTTPS
- ✅ Easy continuous deployment
- ✅ Great for Next.js apps

**Steps:**

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial setup for [Your Church Name]"
   git push origin main
   ```

2. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Sign up / Login
   - Click **"New site from Git"**
   - Choose **GitHub** and select your repository
   - Grant permissions if asked

3. **Configure Build Settings**
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - Click **"Show advanced"**
   - Add environment variables:
     ```
     NEON_DATABASE_URL=your_production_neon_url
     JWT_SECRET=your_production_jwt_secret
     ```

4. **Deploy**
   - Click **"Deploy site"**
   - Wait 2-3 minutes for build
   - Your app will be live at `https://your-site-name.netlify.app`

5. **Custom Domain (Optional)**
   - In Netlify dashboard: **Domain settings** → **Add custom domain**
   - Follow instructions to configure DNS

### Option B: Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Add environment variables
vercel env add NEON_DATABASE_URL production
vercel env add JWT_SECRET production
```

## 🔧 Post-Deployment Checklist

- [ ] Test login with admin account
- [ ] Change admin password
- [ ] Create at least one test month leader account
- [ ] Create at least one test sheep seeker account
- [ ] Register a test new convert
- [ ] Mark a milestone as completed
- [ ] Record attendance for test convert
- [ ] Test on mobile device (install as PWA)
- [ ] Verify all pages load correctly
- [ ] Test Excel bulk registration

## 📊 Using FLCSeek

### For Super Admins
1. **Dashboard:** View system-wide statistics
2. **Users:** Manage all user accounts
3. **Groups:** Create/edit monthly groups
4. **Milestones:** Configure spiritual growth stages
5. **Converts:** View all registered converts across months
6. **Analytics:** Track system performance
7. **Database:** Run migrations, view stats

### For Month Leaders (Admins)
1. Login and view your assigned month dashboard
2. **Register Converts:** 
   - Single: People → Register New Convert
   - Bulk: People → Bulk Register (Excel import)
3. **Track Progress:** View milestone completion rates
4. **Mark Attendance:** Attendance → Mark attendance
5. **View Reports:** Progress page for detailed stats

### For Sheep Seekers (Leaders)
1. Login to see converts in your assigned month
2. Click on a convert to see their profile
3. Mark milestones as completed
4. Record church attendance
5. View individual progress

## 🆘 Getting Help

### Common Issues

**Can't login after deployment**
- Check environment variables are set in Netlify/Vercel
- Ensure `NEON_DATABASE_URL` points to your database
- Verify superadmin account exists: Run SQL query `SELECT * FROM users WHERE username='superadmin'`

**Database connection errors**
- Check Neon database is active (not paused on free tier)
- Verify connection string includes `?sslmode=require`
- Check database firewall allows connections

**Build fails**
- Run `npm run build` locally first to check for errors
- Verify all dependencies are in `package.json`
- Check Node.js version matches (18+)

### Resources

- **FLCSeek Documentation:** [README.md](./README.md)
- **Performance Guide:** [PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md)
- **Database Schema:** [db/migrations/000_initial_setup.sql](./db/migrations/000_initial_setup.sql)
- **Neon Database Docs:** https://neon.tech/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Ant Design Components:** https://ant.design/components

## 📞 Support

For technical issues or questions about forking FLCSeek:
1. Check this setup guide thoroughly
2. Review the main [README.md](./README.md)
3. Check existing GitHub issues
4. Create a new issue with detailed description

---

## 🔧 Appendix

### Installing PostgreSQL Client

**Windows:**
1. Download PostgreSQL installer from https://www.postgresql.org/download/windows/
2. Run installer (you only need "Command Line Tools")
3. Add to PATH: `C:\Program Files\PostgreSQL\15\bin`
4. Verify: `psql --version`

**macOS:**
```bash
# Using Homebrew
brew install postgresql@15

# Verify installation
psql --version
```

**Ubuntu/Debian Linux:**
```bash
sudo apt-get update
sudo apt-get install postgresql-client

# Verify installation
psql --version
```

**Docker Alternative:**
```bash
# If you have Docker installed, use postgres container
docker run --rm -it postgres:15 psql $NEON_DATABASE_URL -f db/migrations/000_initial_setup.sql
```

### Database Backup & Restore

**Backup your data:**
```bash
# Export database to file
pg_dump $NEON_DATABASE_URL > backup_$(date +%Y%m%d).sql

# Or use Neon's built-in backups (Dashboard → Backups)
```

**Restore from backup:**
```bash
psql $NEON_DATABASE_URL < backup_20251027.sql
```

### Running Additional Migrations

If new migrations are added to the project:

1. **Via Admin Panel:**
   - Super Admin → Database Management
   - Find new migration file
   - Click "Run Migration"

2. **Via Command Line:**
   ```bash
   psql $NEON_DATABASE_URL -f db/migrations/NEW_MIGRATION.sql
   ```

---

**Congratulations! 🎉 You've successfully set up FLCSeek for your organization.**

Start registering new converts and tracking their spiritual growth journey!
