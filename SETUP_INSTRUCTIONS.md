# FLC Sheep Seeking - Setup Instructions

## Overview
FLC Sheep Seeking is a church progress tracking system for managing 12 departments (January - December). The system allows Super Admins and Sheep Seekers to track member progress through 15 spiritual stages and monitor church attendance.

## Prerequisites
- Node.js 18+ installed
- A Supabase account
- mNotify API credentials (for SMS functionality)

## Database Setup

### 1. Execute the Migration

You need to run the SQL migration file located at `supabase/migrations/001_initial_schema.sql` in your Supabase database.

**Steps:**
1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and execute the SQL in the Supabase SQL Editor

This will create:
- 5 database tables (users, registered_people, progress_records, attendance_records, sms_logs)
- Row Level Security (RLS) policies
- A default super admin user (username: `admin`, password: `admin123`)

### 2. Configure Environment Variables

The `.env` file already contains the Supabase credentials. Update the following:

```env
JWT_SECRET=flc-sheep-seeking-super-secret-key-change-in-production
MNOTIFY_API_KEY=your_actual_mnotify_api_key
MNOTIFY_SENDER_ID=FLC
```

**Important:**
- Change the JWT_SECRET to a strong random string in production
- Add your actual mNotify API key to enable SMS functionality
- If you don't have mNotify credentials yet, the system will still work but SMS features will be disabled

## Installation

```bash
npm install
```

## Running the Application

### Development Mode
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Build
```bash
npm run build
npm run start
```

## Default Login Credentials

After running the database migration, you can log in with:

- **Username:** `admin`
- **Password:** `admin123`

**Important:** Change this password immediately after first login by creating a new Super Admin user and deleting the default one.

## User Roles

### Super Admin
- Full access to all 12 departments
- Can view all members across departments
- Can create new Sheep Seeker users
- Can send weekly SMS reminders
- Access to reports and analytics

### Sheep Seeker
- Manages members in their assigned department only
- Can register new people
- Can track member progress through 15 stages
- Can record attendance
- Cannot access other departments

## Features

### Progress Tracking (15 Stages)
1. Completed New Believers School
2. Completed Soul-Winning School
3. Visited (First Quarter)
4. Visited (Second Quarter)
5. Visited (Third Quarter)
6. Baptised in Water
7. Baptised in the Holy Ghost
8. Joined Basonta or Creative Arts
9. Completed Seeing & Hearing Education
10. Introduced to Lead Pastor
11. Introduced to a First Love Mother
12. Attended Church Social Outing
13. Attended All-Night Prayer
14. Attended "Meeting God"
15. Invited a Friend to Church

### Attendance Tracking
- Goal: 26 church attendances
- Automatic SMS notification when goal is reached
- Visual progress indicators

### SMS Notifications
- Welcome SMS when a person is registered
- Completion SMS when 26 attendances reached
- Stage completion SMS when progress milestones are reached
- Weekly reminder SMS (sent by Super Admin)

## Creating Additional Users

Only Super Admins can create new users. To create a Sheep Seeker:

1. Log in as Super Admin
2. Use the API endpoint `/api/auth/register` with the following payload:

```json
{
  "username": "january_seeker",
  "password": "secure_password",
  "role": "sheep_seeker",
  "department_name": "January",
  "phone_number": "0123456789"
}
```

**Department Names Must Be:**
January, February, March, April, May, June, July, August, September, October, November, December

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Create new user (Super Admin only)

### People Management
- `GET /api/people` - List people (filtered by role/department)
- `POST /api/people` - Register new person
- `GET /api/people/[id]` - Get person details with progress and attendance

### Progress Tracking
- `PATCH /api/progress/[person_id]` - Update progress stage

### Attendance
- `POST /api/attendance/[person_id]` - Record attendance
- `GET /api/attendance/[person_id]` - Get attendance records

### Reports & SMS
- `GET /api/departments/summary` - Get all departments summary (Super Admin only)
- `POST /api/sms/weekly-reminder` - Send weekly reminders (Super Admin only)
- `GET /api/reports/sms-logs` - View SMS logs (Super Admin only)

## Deployment

### Netlify Deployment

1. Connect your repository to Netlify
2. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - **Framework preset:** Next.js

3. Add environment variables in Netlify:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `JWT_SECRET`
   - `MNOTIFY_API_KEY`
   - `MNOTIFY_SENDER_ID`

4. Deploy!

**Note:** This is a Next.js application with API routes, so it requires server-side rendering. Make sure Netlify Functions are enabled.

## Theme Customization

The application uses a custom color scheme:
- **Primary Color:** #003366 (Dark Blue)
- **Success Color:** #00b300 (Green)
- **Error Color:** #e60000 (Red)

To customize these colors, edit the `token` configuration in `components/AppConfigProvider.tsx`.

## Troubleshooting

### SMS Not Sending
- Verify your mNotify API credentials are correct
- Check the SMS logs table in Supabase for error messages
- The system will log all SMS attempts even if they fail

### Authentication Issues
- Make sure JWT_SECRET is set in your .env file
- Clear browser localStorage and try logging in again
- Check that the database migration was executed successfully

### Build Errors
- Run `npm install` to ensure all dependencies are installed
- Make sure you're using Node.js 18 or higher
- Clear `.next` folder and rebuild: `rm -rf .next && npm run build`

## Support

For issues or questions, please refer to the codebase documentation or contact the development team.

## License

This project is proprietary software developed for FLC (First Love Church).
