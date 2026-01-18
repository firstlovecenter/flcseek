# Prisma ORM Integration

This project now includes Prisma ORM for type-safe database access with Next.js 15.

## Setup Complete ✅

The following has been configured:
- ✅ Prisma Client installed
- ✅ Complete schema defined based on existing database structure
- ✅ Prisma client utility created at `src/lib/prisma.ts`
- ✅ All database models mapped (Users, Groups, NewConverts, etc.)
- ✅ Example API route created at `src/app/api/example/route.ts`

## Database Models

The following Prisma models are available:

- **User** - System users (superadmin, lead pastor, admin, leader)
- **Group** - Month-based groups
- **Milestone** - Spiritual growth stages (18 milestones)
- **NewConvert** - Registered new converts
- **ProgressRecord** - Milestone completion tracking
- **AttendanceRecord** - Church attendance tracking
- **UserGroup** - Multi-group assignment junction table
- **ActivityLog** - Audit trail
- **PasswordResetToken** - Password reset functionality
- **Notification** - User notifications
- **RateLimitRecord** - Rate limiting tracking

## Usage

### Basic Prisma Client Usage

```typescript
import { prisma } from '@/lib/prisma'

// Find all users
const users = await prisma.user.findMany()

// Create a new convert
const convert = await prisma.newConvert.create({
  data: {
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
    groupId: 'group-uuid',
  },
})

// Update progress
await prisma.progressRecord.update({
  where: { id: 'record-id' },
  data: { isCompleted: true, dateCompleted: new Date() },
})

// Complex queries with relations
const userWithData = await prisma.user.findUnique({
  where: { id: 'user-id' },
  include: {
    groups: true,
    leaderGroups: {
      include: {
        newConverts: true,
      },
    },
    registeredConverts: true,
  },
})
```

### Type Safety

Prisma provides full TypeScript type safety:

```typescript
// TypeScript knows all available fields
const user = await prisma.user.findUnique({
  where: { id: 'user-id' },
})

// TypeScript error if field doesn't exist
// user.invalidField // ❌ Error!
user.firstName // ✅ Works!
```

### Transactions

```typescript
// Atomic operations
await prisma.$transaction(async (tx) => {
  const newConvert = await tx.newConvert.create({
    data: { /* ... */ },
  })

  await tx.progressRecord.createMany({
    data: milestones.map((milestone) => ({
      personId: newConvert.id,
      stageNumber: milestone.stageNumber,
      stageName: milestone.stageName,
    })),
  })
})
```

## Common Commands

```bash
# Generate Prisma client (after schema changes)
npx prisma generate

# View your database in Prisma Studio
npx prisma studio

# Pull database schema to Prisma schema
npx prisma db pull

# Format schema file
npx prisma format

# Validate schema
npx prisma validate
```

## Migration from Direct SQL

You can gradually migrate from direct SQL queries to Prisma:

1. **Keep existing code** - Your Neon client still works
2. **Add Prisma for new features** - Use Prisma for new endpoints
3. **Migrate incrementally** - Rewrite old queries as time permits

Both approaches work side-by-side:

```typescript
// Old way (still works)
import { query } from '@/lib/neon'
const users = await query('SELECT * FROM users')

// New way with Prisma
import { prisma } from '@/lib/prisma'
const users = await prisma.user.findMany()
```

## Benefits of Prisma

✅ **Type Safety** - Catch errors at compile time, not runtime  
✅ **Auto-completion** - Full IntelliSense support in VS Code  
✅ **Relationships** - Easy to query related data  
✅ **Migration Tools** - Track database schema changes  
✅ **Query Builder** - No more SQL string concatenation  
✅ **Connection Pooling** - Built-in connection management  
✅ **Validation** - Automatic data validation  

## Configuration

Database connection is configured in `prisma.config.ts`:

```typescript
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"],
  },
})
```

Make sure your `.env` file has:

```env
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

## Next Steps

1. **Explore the schema** - Review `prisma/schema.prisma`
2. **Try Prisma Studio** - Run `npx prisma studio` to browse your data
3. **Migrate existing endpoints** - Start converting SQL queries to Prisma
4. **Add relationships** - Use Prisma's `include` and `select` for efficient queries

## Learn More

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma with Next.js](https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices)
- [CRUD Operations](https://www.prisma.io/docs/concepts/components/prisma-client/crud)
- [Relation Queries](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries)
