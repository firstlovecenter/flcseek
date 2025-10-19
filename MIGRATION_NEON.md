# Migration from Supabase to Neon Database

## Summary
This document describes the migration from Supabase to Neon database that was completed on October 18, 2025.

## What Changed

### Database Client
- **Before:** `@supabase/supabase-js` client
- **After:** `@neondatabase/serverless` (Neon PostgreSQL client)

### Files Modified

#### 1. Database Connection (`lib/`)
- **Deleted:** `lib/supabase.ts` - Supabase client configuration
- **Created:** `lib/neon.ts` - Neon database client with connection pool and query helper

#### 2. API Routes (All refactored from Supabase to SQL)
- `app/api/auth/login/route.ts` - Login authentication
- `app/api/auth/register/route.ts` - User registration
- `app/api/people/route.ts` - People listing and creation
- `app/api/people/[id]/route.ts` - Individual person details
- `app/api/progress/[person_id]/route.ts` - Progress tracking
- `app/api/attendance/[person_id]/route.ts` - Attendance management
- `app/api/departments/summary/route.ts` - Department summaries
- `app/api/sms/weekly-reminder/route.ts` - SMS reminders
- `app/api/reports/sms-logs/route.ts` - SMS logs

#### 3. Utilities
- `lib/mnotify.ts` - SMS logging updated to use Neon

#### 4. Database Migration
- **Created:** `supabase/migrations/001_neon_schema.sql` - Neon-compatible schema (without RLS)
- **Created:** `scripts/migrate-neon.ts` - Migration runner script
- **Created:** `scripts/generate-hash.ts` - Bcrypt hash generator

#### 5. Configuration
- **Updated:** `package.json` - Added `migrate-neon` script, removed Supabase dependency
- **Created:** `.env.local` - Environment variables for Neon
- **Updated:** `README.md` - Updated documentation

## Key Differences

### Query Syntax
**Supabase:**
```typescript
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('username', username)
  .maybeSingle();
```

**Neon:**
```typescript
const result = await query(
  'SELECT * FROM users WHERE username = $1',
  [username]
);
const user = result.rows[0];
```

### Row Level Security (RLS)
- **Supabase:** Had RLS policies using `auth.uid()`
- **Neon:** RLS policies removed, security handled in API layer with JWT tokens

### Error Handling
- **Supabase:** Returns `{ data, error }` structure
- **Neon:** Uses try-catch with standard PostgreSQL errors

## Environment Variables

### Required in `.env.local`
```env
# Neon Database
NEON_DATABASE_URL=postgresql://user:pass@host/database?sslmode=require

# mNotify API
MNOTIFY_API_KEY=your_mnotify_api_key

# JWT Secret
JWT_SECRET=your-secret-jwt-key-change-in-production
```

### Removed (No longer needed)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Database Setup

### Running the Migration
```bash
npm run migrate-neon
```

This will:
1. Create all database tables (users, registered_people, progress_records, attendance_records, sms_logs)
2. Create indexes for performance
3. Insert the default admin user (username: admin, password: admin123)

### Connection String Format
```
postgresql://[user]:[password]@[host]/[database]?sslmode=require&channel_binding=require
```

## Default Credentials
- **Username:** admin
- **Password:** admin123

⚠️ **Important:** Change these credentials after first login!

## Testing Checklist

### Authentication
- [x] Login with admin credentials
- [ ] Create new Sheep Seeker user
- [ ] Login with Sheep Seeker credentials

### People Management
- [ ] Register a new person
- [ ] View person details
- [ ] Filter people by department

### Progress Tracking
- [ ] Mark progress stages as complete
- [ ] Verify SMS sent on stage completion
- [ ] View progress history

### Attendance
- [ ] Record attendance for a person
- [ ] View attendance history
- [ ] Verify completion SMS at 26 attendances

### Reports (Super Admin)
- [ ] View department summary
- [ ] Send weekly reminders
- [ ] View SMS logs

## Rollback Plan

If you need to rollback to Supabase:

1. Reinstall Supabase client:
   ```bash
   npm install @supabase/supabase-js --legacy-peer-deps
   ```

2. Restore the original `lib/supabase.ts` file

3. Revert all API route changes (use git to restore)

4. Update environment variables back to Supabase credentials

## Performance Considerations

### Improvements
- Direct SQL queries are more explicit and easier to optimize
- Connection pooling with Neon for better performance
- Reduced overhead from Supabase client layer

### Potential Issues
- More verbose query code
- Manual parameter binding required
- Need to handle SQL injection prevention manually (using parameterized queries)

## Security Notes

1. **SQL Injection:** All queries use parameterized statements ($1, $2, etc.)
2. **Authentication:** Still using JWT tokens for API authentication
3. **Authorization:** Role-based checks in API layer (no RLS)
4. **Password Hashing:** Still using bcrypt with 10 rounds

## Support

For issues or questions about the migration:
1. Check compilation errors with `npm run typecheck`
2. Review database connection in `lib/neon.ts`
3. Verify environment variables in `.env.local`
4. Check Neon dashboard for database status

## Next Steps

1. ✅ Complete migration
2. ✅ Run database migration script
3. ⏳ Test all features thoroughly
4. ⏳ Update SETUP_INSTRUCTIONS.md
5. ⏳ Update DEPLOYMENT.md
6. ⏳ Deploy to production
