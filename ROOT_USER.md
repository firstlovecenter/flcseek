# Root User Documentation

## Overview

The FLCSeek application includes a hardcoded **root user** that provides emergency access to the system. This user has the following characteristics:

- ✅ Can login even when the database is unavailable
- ✅ Has full superadmin privileges
- ✅ Does NOT appear in any user lists or management interfaces
- ✅ Cannot be deleted or modified through the UI
- ✅ Credentials can be customized via environment variables

## Default Credentials

**Username:** `root`  
**Password:** `root@flcseek2025`

> ⚠️ **SECURITY WARNING**: Change these credentials in production by setting environment variables!

## Configuration

To customize the root user credentials, set these environment variables:

```bash
ROOT_USERNAME=your_custom_username
ROOT_PASSWORD=your_secure_password
```

Add these to your `.env` file or deployment environment (Netlify, Vercel, etc.).

## Usage

### Login
Simply use the root credentials at the login page:
- Username: `root` (or your custom username)
- Password: `root@flcseek2025` (or your custom password)

The root user will be authenticated immediately without database queries.

### Access Level
Once logged in, the root user has:
- Full superadmin dashboard access
- Ability to manage users, groups, milestones
- Access to all analytics and reports
- Database management capabilities

### Invisibility
The root user will NOT appear in:
- `/api/users` endpoint
- `/api/superadmin/users` endpoint
- `/api/users/sheep-seekers` endpoint
- User management tables in the UI
- User count statistics

## Use Cases

1. **Database Outage**: Login when database connection fails
2. **Emergency Access**: Recover access when all admin accounts are locked
3. **Initial Setup**: First login before any database users exist
4. **Testing**: Quick access for development/testing without seeding database

## Technical Implementation

### Files Modified
- `lib/constants.ts` - ROOT_USER configuration
- `app/api/auth/login/route.ts` - Root user authentication logic
- `app/api/users/route.ts` - Filters root user from results
- `app/api/superadmin/users/route.ts` - Filters root user from results
- `app/api/users/sheep-seekers/route.ts` - Filters root user from results

### Authentication Flow
```typescript
// Check root user BEFORE database query
if (username === ROOT_USER.USERNAME && password === ROOT_USER.PASSWORD) {
  // Return token immediately
  return generateToken({ id: 'root-user-id', role: 'superadmin', ... });
}

// Continue with normal database authentication
const user = await query('SELECT * FROM users WHERE username = $1', [username]);
```

### Filtering Logic
```typescript
// Filter out root user from all user listings
const filteredUsers = result.rows.filter(user => user.id !== ROOT_USER.ID);
```

## Security Best Practices

1. ✅ **Change default password** in production
2. ✅ Store credentials in environment variables, not in code
3. ✅ Use a strong, unique password for the root account
4. ✅ Limit knowledge of root credentials to essential personnel only
5. ✅ Monitor root user login attempts in production logs
6. ✅ Consider disabling root user in production if not needed

## Disabling Root User

To disable the root user feature, you can:

1. Set impossible-to-match credentials:
   ```bash
   ROOT_USERNAME=DISABLED
   ROOT_PASSWORD=$(openssl rand -base64 64)
   ```

2. Or comment out the root user check in `app/api/auth/login/route.ts`

## Support

For issues or questions about the root user feature, contact the development team.
