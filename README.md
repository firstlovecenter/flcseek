# FLC Sheep Seeking

A comprehensive church progress tracking system for managing member spiritual growth and attendance across 12 departments.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database
1. Open your Supabase dashboard
2. Go to SQL Editor
3. Copy and run the SQL from `supabase/migrations/001_initial_schema.sql`

### 3. Configure Environment
Update `.env` with your mNotify API credentials:
```env
MNOTIFY_API_KEY=your_actual_api_key
```

### 4. Run the Application
```bash
npm run dev
```

Visit `http://localhost:3000` and log in with:
- **Username:** admin
- **Password:** admin123

## Features

- **12 Department Management** - Organize members by month (January - December)
- **Progress Tracking** - Monitor 15 spiritual growth stages
- **Attendance System** - Track church attendance (goal: 26 times)
- **SMS Notifications** - Automated messages for milestones
- **Role-Based Access** - Super Admin and Sheep Seeker roles
- **Real-Time Analytics** - Department performance dashboards

## Tech Stack

- **Framework:** Next.js 13 with App Router
- **UI Library:** Ant Design
- **Database:** Supabase (PostgreSQL)
- **Authentication:** JWT with bcrypt
- **SMS:** mNotify API
- **Styling:** Tailwind CSS

## Documentation

For detailed setup instructions, API documentation, and deployment guide, see [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md).

## Project Structure

```
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   ├── person/[id]/          # Person detail page
│   ├── sheep-seeker/         # Sheep Seeker dashboard
│   └── super-admin/          # Super Admin dashboard
├── components/               # React components
├── contexts/                 # React contexts (Auth)
├── lib/                      # Utility functions
│   ├── auth.ts              # JWT & password hashing
│   ├── supabase.ts          # Supabase client
│   ├── mnotify.ts           # SMS integration
│   └── constants.ts         # App constants
├── supabase/migrations/     # Database migrations
└── scripts/                 # Setup scripts
```

## User Roles

### Super Admin
- Full access to all departments
- Create Sheep Seeker accounts
- View comprehensive analytics
- Send bulk SMS reminders

### Sheep Seeker
- Manage assigned department only
- Register new members
- Track progress and attendance
- Cannot access other departments

## License

Proprietary - First Love Church (FLC)
