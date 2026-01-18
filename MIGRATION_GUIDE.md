# 🚀 Prisma Migration Guide - Practical Step-by-Step

This guide shows you **exactly how** to migrate from raw SQL to Prisma, one endpoint at a time.

---

## 📋 Migration Checklist

### Phase 1: Setup ✅ DONE
- [x] Prisma installed
- [x] Schema created
- [x] Client generated
- [x] Both Neon and Prisma available

### Phase 2: Migrate Read Operations (START HERE)
- [ ] GET /api/superadmin/users
- [ ] GET /api/superadmin/groups
- [ ] GET /api/superadmin/milestones
- [ ] GET /api/people (new converts)
- [ ] GET /api/progress
- [ ] GET /api/attendance

### Phase 3: Migrate Write Operations
- [ ] POST endpoints (create)
- [ ] PUT/PATCH endpoints (update)
- [ ] DELETE endpoints

### Phase 4: Cleanup
- [ ] Remove unused Neon imports
- [ ] Update tests
- [ ] Final verification

---

## 🎯 Step-by-Step Migration

### Example 1: Migrate GET /api/superadmin/users

**Current Code (Neon):**
```typescript
import { query } from '@/lib/neon';

const result = await query(
  \`SELECT 
     id, username, role, first_name, last_name, email, 
     created_at, updated_at
   FROM users 
   WHERE username NOT IN ('skaduteye', 'sysadmin')
   ORDER BY created_at DESC\`,
  []
);

return NextResponse.json(result.rows);
```

**New Code (Prisma):**
```typescript
import { prisma } from '@/lib/prisma';

const users = await prisma.user.findMany({
  where: {
    username: {
      notIn: ['skaduteye', 'sysadmin']
    }
  },
  select: {
    id: true,
    username: true,
    role: true,
    firstName: true,
    lastName: true,
    email: true,
    createdAt: true,
    updatedAt: true,
  },
  orderBy: {
    createdAt: 'desc'
  }
});

return NextResponse.json(users);
```

**Action Items:**
1. Replace `import { query } from '@/lib/neon'` with `import { prisma } from '@/lib/prisma'`
2. Convert SQL query to Prisma query (see above)
3. Test the endpoint
4. Verify data matches

---

### Example 2: Migrate GET with Relations

**Current Code (SQL with JOIN):**
```typescript
const result = await query(
  \`SELECT 
     nc.id, nc.first_name, nc.last_name, nc.phone_number,
     g.name as group_name, g.year as group_year,
     u.username as registered_by_name
   FROM new_converts nc
   LEFT JOIN groups g ON nc.group_id = g.id
   LEFT JOIN users u ON nc.registered_by = u.id
   WHERE nc.group_id = $1
   ORDER BY nc.created_at DESC\`,
  [groupId]
);
```

**New Code (Prisma with include):**
```typescript
const converts = await prisma.newConvert.findMany({
  where: {
    groupId: groupId
  },
  include: {
    group: {
      select: {
        name: true,
        year: true,
      }
    },
    registeredBy: {
      select: {
        username: true,
      }
    }
  },
  orderBy: {
    createdAt: 'desc'
  }
});

// Transform to match old format if needed
const formatted = converts.map(c => ({
  id: c.id,
  first_name: c.firstName,
  last_name: c.lastName,
  phone_number: c.phoneNumber,
  group_name: c.group?.name,
  group_year: c.group?.year,
  registered_by_name: c.registeredBy?.username,
}));
```

---

### Example 3: Migrate POST (Create)

**Current Code:**
```typescript
const result = await query(
  \`INSERT INTO new_converts 
   (first_name, last_name, phone_number, group_id, registered_by)
   VALUES ($1, $2, $3, $4, $5)
   RETURNING *\`,
  [firstName, lastName, phoneNumber, groupId, userId]
);

return NextResponse.json(result.rows[0]);
```

**New Code:**
```typescript
const newConvert = await prisma.newConvert.create({
  data: {
    firstName,
    lastName,
    phoneNumber,
    groupId,
    registeredById: userId,
  },
  include: {
    group: true,
    registeredBy: {
      select: {
        username: true,
      }
    }
  }
});

return NextResponse.json(newConvert);
```

---

### Example 4: Migrate PATCH/PUT (Update)

**Current Code:**
```typescript
const result = await query(
  \`UPDATE users 
   SET first_name = $1, last_name = $2, email = $3, updated_at = NOW()
   WHERE id = $4
   RETURNING *\`,
  [firstName, lastName, email, userId]
);
```

**New Code:**
```typescript
const updatedUser = await prisma.user.update({
  where: { id: userId },
  data: {
    firstName,
    lastName,
    email,
    // updatedAt automatically managed by @updatedAt
  }
});

return NextResponse.json(updatedUser);
```

---

### Example 5: Migrate Transactions

**Current Code:**
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  
  const convertResult = await client.query(
    'INSERT INTO new_converts (...) VALUES (...) RETURNING id',
    [...]
  );
  
  await client.query(
    'INSERT INTO progress_records (...) VALUES (...)',
    [...]
  );
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

**New Code:**
```typescript
const result = await prisma.$transaction(async (tx) => {
  const convert = await tx.newConvert.create({
    data: { /* ... */ }
  });
  
  await tx.progressRecord.createMany({
    data: milestones.map(m => ({
      personId: convert.id,
      stageNumber: m.stageNumber,
      stageName: m.stageName,
    }))
  });
  
  return convert;
});
```

---

## 🛠️ Recommended Migration Order

### Week 1: Simple Read Endpoints
1. **Milestones** (simplest - no relations)
   - GET /api/superadmin/milestones
   
2. **Groups** (simple relations)
   - GET /api/superadmin/groups
   - GET /api/groups

3. **Users** (medium complexity)
   - GET /api/superadmin/users
   - GET /api/users

### Week 2: Complex Read Endpoints
4. **New Converts** (multiple relations)
   - GET /api/people
   - GET /api/people/[id]

5. **Progress & Attendance** (complex queries)
   - GET /api/progress
   - GET /api/attendance

### Week 3: Write Operations
6. **Create Operations**
   - POST /api/people (create convert)
   - POST /api/groups
   
7. **Update Operations**
   - PATCH /api/people/[id]
   - PUT /api/users/[id]

8. **Delete Operations**
   - DELETE endpoints (migrate last)

### Week 4: Testing & Cleanup
9. **Final verification**
10. **Remove Neon imports**
11. **Update documentation**

---

## 🔍 Testing Strategy

For each migrated endpoint:

### 1. Side-by-Side Comparison
```typescript
// Temporarily keep both for testing
const oldResult = await query('SELECT * FROM users');
const newResult = await prisma.user.findMany();

console.log('Old count:', oldResult.rows.length);
console.log('New count:', newResult.length);
// Verify they match!
```

### 2. Postman/Thunder Client Tests
- Create a test collection
- Test BEFORE migration
- Test AFTER migration
- Compare responses

### 3. Unit Tests (Optional but Recommended)
```typescript
import { prisma } from '@/lib/prisma';

describe('User API', () => {
  it('should fetch all users', async () => {
    const users = await prisma.user.findMany();
    expect(users).toBeDefined();
    expect(Array.isArray(users)).toBe(true);
  });
});
```

---

## 🎓 Quick Reference: Common Patterns

### Filtering
```typescript
// SQL: WHERE role = 'admin' AND deleted_at IS NULL
// Prisma:
where: {
  role: 'admin',
  deletedAt: null
}
```

### Ordering
```typescript
// SQL: ORDER BY created_at DESC
// Prisma:
orderBy: { createdAt: 'desc' }
```

### Limiting
```typescript
// SQL: LIMIT 10 OFFSET 20
// Prisma:
take: 10,
skip: 20
```

### Counting
```typescript
// SQL: SELECT COUNT(*) FROM users
// Prisma:
const count = await prisma.user.count()
```

### Search (LIKE)
```typescript
// SQL: WHERE first_name ILIKE '%john%'
// Prisma:
where: {
  firstName: {
    contains: 'john',
    mode: 'insensitive'
  }
}
```

---

## 🚨 Common Pitfalls & Solutions

### Pitfall 1: Field Name Mapping
**Problem:** SQL uses snake_case, Prisma uses camelCase
```typescript
// SQL column: first_name
// Prisma field: firstName
```
**Solution:** Schema has `@map("first_name")` - Prisma handles this automatically!

### Pitfall 2: NULL vs undefined
```typescript
// ❌ Wrong
where: { email: undefined }

// ✅ Correct
where: { email: null }
```

### Pitfall 3: Returning Different Data Structure
```typescript
// Old: result.rows (array)
// New: direct array

// If you need to match old structure:
return NextResponse.json({ rows: users });
```

### Pitfall 4: Date Handling
```typescript
// SQL returns strings, Prisma returns Date objects
// Frontend might expect strings:
const formatted = users.map(u => ({
  ...u,
  createdAt: u.createdAt.toISOString()
}));
```

---

## 📊 Progress Tracking

Create a simple spreadsheet or GitHub issue:

| Endpoint | Status | Date | Notes |
|----------|--------|------|-------|
| GET /api/superadmin/users | ✅ Done | 2026-01-18 | Working |
| POST /api/people | 🔄 In Progress | | Testing |
| GET /api/progress | ⏳ Pending | | Next |

---

## 🎯 Next Immediate Steps

1. **Pick one simple endpoint** (recommendation: GET /api/superadmin/milestones)
2. **Create a backup branch**: `git checkout -b migrate/milestones-endpoint`
3. **Migrate the endpoint** following Example 1
4. **Test thoroughly** with Postman/curl
5. **Commit if successful**: `git commit -m "Migrate milestones endpoint to Prisma"`
6. **Merge to main** after testing
7. **Repeat** for next endpoint

---

## 🆘 Need Help?

If you get stuck:
1. Check [`PRISMA_MIGRATION_EXAMPLES.ts`](PRISMA_MIGRATION_EXAMPLES.ts) for patterns
2. Review Prisma docs: https://www.prisma.io/docs
3. Use Prisma Studio to explore data: `npm run prisma:studio`
4. Compare old vs new query results side-by-side

---

## 📝 Template for Migrating an Endpoint

```typescript
// src/app/api/your-endpoint/route.ts

// OLD:
// import { query } from '@/lib/neon';

// NEW:
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // OLD:
    // const result = await query('SELECT * FROM table', []);
    // return NextResponse.json(result.rows);

    // NEW:
    const data = await prisma.table.findMany();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
```

**Remember:** You can always revert if something breaks! Git is your friend. 🎉
