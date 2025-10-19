# FLC Sheep Seeking

A comprehensive church progress tracking system for managing member spiritual growth and attendance across 12 departments.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database
1. Create a Neon database account at https://neon.tech
2. Create a new project and get your connection string
3. Create a `.env.local` file in the root directory with:
```env
NEON_DATABASE_URL=your_neon_connection_string_here
MNOTIFY_API_KEY=your_mnotify_api_key
JWT_SECRET=your-secret-jwt-key-change-in-production
```
4. Run the database migration:
```bash
npm run migrate-neon
```

### 3. Run the Application
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
- **Database:** Neon (PostgreSQL)
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
│   ├── neon.ts              # Neon database client
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
