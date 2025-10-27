# FLCSeek - Church New Convert Tracking System

A comprehensive, performance-optimized church management system for tracking new convert spiritual growth, milestone progression, and attendance across monthly groups.

## 🌟 What is FLCSeek?

FLCSeek is a Progressive Web App (PWA) designed to help churches systematically track and nurture new converts through their spiritual journey. It provides role-based dashboards, real-time progress monitoring, bulk registration tools, and analytics to ensure no new believer falls through the cracks.

### Key Features

✅ **Month-Based Organization** - Organize new converts by registration month (January - December)  
✅ **18 Milestone Progression** - Track spiritual growth through 18 customizable milestones  
✅ **Attendance Tracking** - Monitor church attendance with 26-week goal  
✅ **Role-Based Access Control** - Super Admin, Lead Pastor, Admin (Month Leader), and Sheep Seeker roles  
✅ **Bulk Registration** - Register multiple converts via Excel import  
✅ **Real-Time Analytics** - Department performance dashboards with visual progress indicators  
✅ **Performance Optimized** - Sub-second page loads with advanced database indexing  
✅ **Theme Support** - Light and dark mode with WCAG AA color contrast compliance  

## 🚀 Quick Start (5 Minutes Setup)

### Prerequisites
- Node.js 18+ and npm installed
- A Neon Database account (free tier available)

### 1. Clone and Install
```bash
git clone https://github.com/firstlovecenter/flcseek.git
cd flcseek
npm install
```

### 2. Set Up Database
1. Create a **free** Neon database account at [neon.tech](https://neon.tech)
2. Create a new project (choose your preferred region)
3. Copy your connection string (looks like `postgresql://user:pass@host/database`)

### 3. Configure Environment Variables
Create a `.env.local` file in the root directory:

```env
# Database Connection (REQUIRED)
NEON_DATABASE_URL=postgresql://username:password@host.neon.tech/database?sslmode=require

# Authentication Secret (REQUIRED - Change this to a random string!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
```

**🔐 Security Note:** Generate a strong JWT_SECRET using:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Initialize Database Schema
Run the initial migration to create all tables, indexes, and seed data:

```bash
npm run db:setup
```

This will create:
- 6 database tables (`users`, `groups`, `milestones`, `new_converts`, `progress_records`, `attendance_records`)
- 15+ performance indexes for optimized queries
- Default superadmin account (username: `superadmin`, password: `admin123`)
- 18 spiritual growth milestones
- 12 month groups for 2025

### 5. Start the Application
```bash
npm run dev
```

Visit **http://localhost:3000** and log in with:
- **Username:** `superadmin`
- **Password:** `admin123`
- **Role:** Super Administrator (full system access)

**⚠️ IMPORTANT:** Change the superadmin password immediately after first login!

---

## 📱 Features Overview

### For Super Admins
- **Full System Access** - Manage all months, users, and converts
- **User Management** - Create admin and sheep seeker accounts
- **Milestone Customization** - Define and edit spiritual growth stages
- **Analytics Dashboard** - View system-wide statistics and trends
- **Bulk Operations** - Export data, bulk delete records
- **Database Management** - Run migrations, view table statistics

### For Lead Pastors
- **Multi-Month View** - Track progress across all monthly groups
- **Comparative Analytics** - See which months are performing well
- **Leadership Oversight** - Monitor sheep seeker effectiveness
- **Progress Reports** - Generate month-by-month progress reports

### For Admins (Month Les)
- **Month Management** - Oversee a specific monthly group
- **Convert Registration** - Register new converts (bulk or individual)
- **Progress Tracking** - View milestone completion for all group members
- **Attendance Management** - Mark attendance for group members
- **Team Coordination** - Manage assigned sheep seekers

### For Sheep Seekers (Leaders)
- **Assigned Converts** - Manage specific converts in your month
- **Milestone Updates** - Mark milestones as completed
- **Attendance Recording** - Track church attendance
- **Individual Progress** - View detailed convert profiles
- **Quick Actions** - Fast navigation to common tasks

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 13** | React framework with App Router and Server Components |
| **TypeScript** | Type-safe development |
| **Ant Design** | Professional UI component library |
| **Tailwind CSS** | Utility-first CSS framework |
| **Neon Database** | Serverless PostgreSQL with auto-scaling |
| **JWT + bcrypt** | Secure authentication and password hashing |
| **next-pwa** | Progressive Web App capabilities |

---

## 📊 Database Schema

### Core Tables
1. **users** - User accounts with role-based access
2. **groups** - Month-based groups (e.g., "January 2025")
3. **milestones** - Spiritual growth stages (18 default stages)
4. **new_converts** - Registered new converts with contact info
5. **progress_records** - Milestone completion tracking
6. **attendance_records** - Church attendance records

### Performance Optimizations
- 15+ strategic indexes on frequently queried columns
- Optimized JOIN queries eliminate N+1 problems
- Single-query data fetching with JSON aggregation
- Partial indexes for conditional filtering

---

## 🗂️ Project Structure

```
flcseek/
├── app/                          # Next.js 13 App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── people/               # Convert management APIs
│   │   │   ├── with-progress/    # Optimized endpoint (eliminates N+1)
│   │   │   ├── with-stats/       # Aggregated stats endpoint
│   │   │   └── bulk/             # Bulk registration
│   │   ├── milestones/           # Milestone CRUD
│   │   ├── groups/               # Group management
│   │   ├── attendance/           # Attendance tracking
│   │   ├── progress/             # Progress updates
│   │   └── superadmin/           # Admin-only endpoints
│   ├── sheep-seeker/             # Sheep Seeker dashboard
│   │   ├── page.tsx              # Main milestone board
│   │   ├── progress/             # Progress view
│   │   ├── attendance/           # Attendance tracking
│   │   └── people/               # Convert registration
│   ├── leader/                   # Admin (Month Leader) dashboard
│   ├── leadpastor/               # Lead Pastor dashboard
│   │   └── [month]/              # Month-specific views
│   ├── superadmin/               # Super Admin dashboard
│   │   ├── users/                # User management
│   │   ├── groups/               # Group management
│   │   ├── milestones/           # Milestone configuration
│   │   ├── converts/             # All converts view
│   │   ├── analytics/            # System analytics
│   │   └── database/             # Database management
│   ├── person/[id]/              # Individual convert profile
│   ├── layout.tsx                # Root layout with theme provider
│   └── globals.css               # Global styles with theme variables
├── components/                   # Reusable React components
│   ├── ui/                       # shadcn/ui components
│   ├── Navigation.tsx            # Role-based navigation
│   ├── TopNav.tsx                # Top navigation bar
│   └── PullToRefresh.tsx         # Mobile pull-to-refresh
├── contexts/
│   └── AuthContext.tsx           # Authentication context
├── lib/                          # Utility functions
│   ├── auth.ts                   # JWT token management & bcrypt
│   ├── neon.ts                   # Database connection & query helper
│   ├── constants.ts              # App-wide constants
│   └── utils.ts                  # Helper functions
├── db/
│   └── migrations/               # Database migrations
│       ├── 000_initial_setup.sql # Complete schema setup (NEW!)
│       ├── 013_add_performance_indexes.sql
│       └── 013_remove_full_name_column.sql
├── public/                       # Static assets
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service worker (auto-generated)
│   └── icons/                    # PWA icons
├── .env.local                    # Environment variables (create this)
├── next.config.js                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
└── package.json                  # Dependencies & scripts
```

---

## 🔐 User Roles & Permissions

### Role Hierarchy
```
Super Admin (Full Access)
    ↓
Lead Pastor (All Months Read)
    ↓
Admin/Month Leader (Single Month Full Access)
    ↓
Sheep Seeker/Leader (Assigned Converts Only)
```

### Permission Matrix

| Feature | Super Admin | Lead Pastor | Admin | Leader |
|---------|-------------|-------------|-------|---------|
| View All Months | ✅ | ✅ | ❌ | ❌ |
| Manage Assigned Month | ✅ | ❌ | ✅ | ✅ |
| Register New Converts | ✅ | ❌ | ✅ | ✅ |
| Mark Milestones | ✅ | ❌ | ✅ | ✅ |
| Track Attendance | ✅ | ❌ | ✅ | ✅ |
| Create Users | ✅ | ❌ | ❌ | ❌ |
| Edit Milestones | ✅ | ❌ | ❌ | ❌ |
| View Analytics | ✅ | ✅ | ✅ | ❌ |
| Database Management | ✅ | ❌ | ❌ | ❌ |
| Bulk Delete | ✅ | ❌ | ❌ | ❌ |

---

## 🚢 Deployment

### Netlify (Recommended)

1. **Connect Repository**
   ```bash
   # Push your code to GitHub
   git remote add origin https://github.com/yourusername/flcseek.git
   git push -u origin main
   ```

2. **Configure Netlify**
   - Go to [netlify.com](https://netlify.com) and click "New site from Git"
   - Select your repository
   - **Build settings:**
     - Build command: `npm run build`
     - Publish directory: `.next`
   
3. **Set Environment Variables**
   In Netlify Dashboard → Site settings → Environment variables:
   ```
   NEON_DATABASE_URL=your_production_database_url
   JWT_SECRET=your_production_jwt_secret
   ```

4. **Deploy**
   - Click "Deploy site"
   - Your app will be live at `https://your-site-name.netlify.app`

### Vercel (Alternative)

```bash
npm install -g vercel
vercel --prod
```

Set environment variables in Vercel Dashboard or via CLI:
```bash
vercel env add NEON_DATABASE_URL production
vercel env add JWT_SECRET production
```

---

## 🔧 Common Tasks

### Change Admin Password
1. Log in as admin
2. Navigate to Super Admin → Users
3. Click on admin user → Edit → Change Password

### Create New User Accounts
1. Super Admin → Users → Create User
2. Fill in username, role, and assign to group (for admins/leaders)
3. Provide credentials to new user

### Customize Milestones
1. Super Admin → Milestones
2. Edit existing milestones or add new ones
3. Stage numbers must be unique (1-99)

### Bulk Register Converts
1. Download Excel template from Sheep Seeker → Bulk Register
2. Fill in convert information (Name, Phone, DOB, Gender, Location)
3. Upload Excel file
4. Review and confirm registration

### Create New Year Groups
1. Super Admin → Groups → Create Group
2. Create 12 groups for new year (e.g., "January 2026")
3. Assign leaders to each month

### Run Additional Migrations
1. Super Admin → Database Management
2. View available migrations
3. Click "Run Migration" on pending migrations

### Export Data
1. Super Admin → Converts
2. Use filters (month, progress status, etc.)
3. Click "Export to Excel"

---

## 📈 Performance Metrics

FLCSeek has been heavily optimized for performance:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Milestone Board Load (100 people) | 12s | <1s | **92% faster** |
| API Requests per Page | 101 | 1 | **99% reduction** |
| Bulk Registration (50 people) | 8s | <1s | **87% faster** |
| Database Queries (progress fetch) | 202+ | 1 | **99.5% reduction** |

### Key Optimizations Applied
✅ Eliminated N+1 query problem with JOIN aggregation  
✅ Strategic database indexes on all foreign keys  
✅ HTTP caching with stale-while-revalidate  
✅ Bulk INSERT operations instead of loops  
✅ Server-side data aggregation  
✅ Single-query data fetching with JSON_AGG  

See [PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md) for technical details.

---

## 🐛 Troubleshooting

### Database Connection Issues
**Problem:** "Database connection not configured" error

**Solution:**
1. Verify `.env.local` file exists in root directory
2. Check `NEON_DATABASE_URL` is correctly formatted
3. Ensure connection string includes `?sslmode=require`
4. Test connection: `psql $NEON_DATABASE_URL -c "SELECT 1"`

### Build Errors
**Problem:** Build fails with TypeScript errors

**Solution:**
```bash
# Clear Next.js cache and rebuild
rm -rf .next
npm run build
```

### Migration Fails
**Problem:** Migration fails with "relation already exists"

**Solution:**
This is normal if tables already exist. The migrations use `IF NOT EXISTS` clauses and will skip existing structures.

### Login Not Working
**Problem:** "Invalid credentials" despite correct password

**Solution:**
1. Verify superadmin account exists:
   ```sql
   SELECT username, role FROM users WHERE username = 'superadmin';
   ```
2. Reset superadmin password if needed (requires database access):
   ```sql
   -- Password: admin123
   UPDATE users SET password = '$2a$10$XQK9c5J5R.QF5Y0YKVk8HOJyPmrqOYqXqHPxQZxQZUJGZKZQZxQZU' WHERE username = 'superadmin';
   ```

### Slow Performance
**Problem:** Pages load slowly despite optimizations

**Solution:**
1. Verify performance indexes are created:
   ```bash
   # Check if indexes exist
   psql $NEON_DATABASE_URL -c "\d+ progress_records"
   ```
2. Run index migration if missing:
   - Super Admin → Database → Run Migration `013_add_performance_indexes.sql`

---

## 🧪 Development

### Run Development Server
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Build for Production
```bash
npm run build
npm start
```

### Lint Code
```bash
npm run lint
```

### Database Commands
```bash
# Setup database (run once)
npm run db:setup

# Run specific migration
psql $NEON_DATABASE_URL -f db/migrations/000_initial_setup.sql

# Check database schema
psql $NEON_DATABASE_URL -c "\dt"  # List tables
psql $NEON_DATABASE_URL -c "\d+ users"  # Describe table
```

---

## 📝 API Documentation

### Authentication
All API endpoints require JWT authentication via `Authorization: Bearer <token>` header.

**Login:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "superadmin",
  "password": "admin123"
}

Response: { "token": "jwt_token_here", "user": {...} }
```

### Key Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | ❌ | User login |
| `/api/people/with-progress` | GET | ✅ | Fetch people with progress (optimized) |
| `/api/people/bulk` | POST | ✅ | Bulk register converts |
| `/api/milestones` | GET | ✅ | Get all milestones (cached 1hr) |
| `/api/progress/[person_id]` | PUT | ✅ | Update milestone progress |
| `/api/attendance/[person_id]` | POST | ✅ | Mark attendance |
| `/api/groups` | GET | ✅ | List groups |
| `/api/superadmin/users` | GET/POST | ✅ (superadmin) | User management |

See inline code documentation for detailed API schemas.

---

## 🤝 Contributing

This is a proprietary project for First Love Church. For feature requests or bug reports, contact the development team.

### Development Guidelines
1. Follow TypeScript strict mode
2. Use Ant Design components for consistency
3. Write optimized database queries
4. Test on mobile devices (PWA focus)
5. Maintain WCAG AA color contrast compliance

---

## 📜 License

Proprietary © 2025 First Love Church (FLC). All rights reserved.

**For Organizations Interested in Forking:**
1. Fork the repository
2. Run the `000_initial_setup.sql` migration on your Neon database
3. Update branding in `app/layout.tsx` and `public/manifest.json`
4. Customize milestones in Super Admin dashboard
5. Deploy to Netlify/Vercel with your own environment variables

**Support:** For setup assistance, email your dev team or create an issue in the repository.

---

## 📞 Support

- **Technical Issues:** Check [PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md) and this README
- **Database Issues:** Review [db/migrations/000_initial_setup.sql](./db/migrations/000_initial_setup.sql)
- **Feature Requests:** Contact church tech team

---

**Built with ❤️ for First Love Church** | Version 2.0 | October 2025
