/**
 * Migration Guide: Converting SQL Queries to Prisma
 * 
 * This file shows common patterns for converting your existing
 * raw SQL queries to Prisma ORM queries.
 */

import { prisma } from '@/lib/prisma'

// ============================================================================
// EXAMPLE 1: Simple SELECT
// ============================================================================

// SQL:
// SELECT * FROM users WHERE role = 'admin' AND deleted_at IS NULL

// Prisma:
const admins = await prisma.user.findMany({
  where: {
    role: 'admin',
    deletedAt: null,
  },
})

// ============================================================================
// EXAMPLE 2: SELECT with JOIN
// ============================================================================

// SQL:
// SELECT u.*, g.name as group_name 
// FROM users u 
// LEFT JOIN groups g ON u.group_id = g.id
// WHERE u.role = 'leader'

// Prisma:
const leaders = await prisma.user.findMany({
  where: {
    role: 'leader',
  },
  include: {
    group: true, // Automatically joins and includes group data
  },
})

// ============================================================================
// EXAMPLE 3: Count with GROUP BY
// ============================================================================

// SQL:
// SELECT group_id, COUNT(*) as total 
// FROM new_converts 
// GROUP BY group_id

// Prisma:
const convertsByGroup = await prisma.newConvert.groupBy({
  by: ['groupId'],
  _count: true,
})

// ============================================================================
// EXAMPLE 4: Complex JOIN with filters
// ============================================================================

// SQL:
// SELECT nc.*, pr.is_completed, m.stage_name
// FROM new_converts nc
// LEFT JOIN progress_records pr ON nc.id = pr.person_id
// LEFT JOIN milestones m ON pr.stage_number = m.stage_number
// WHERE nc.group_id = $1 AND pr.is_completed = true

// Prisma:
const convertsWithProgress = await prisma.newConvert.findMany({
  where: {
    groupId: 'some-group-id',
    progressRecords: {
      some: {
        isCompleted: true,
      },
    },
  },
  include: {
    progressRecords: {
      where: {
        isCompleted: true,
      },
    },
  },
})

// ============================================================================
// EXAMPLE 5: INSERT
// ============================================================================

// SQL:
// INSERT INTO new_converts (first_name, last_name, phone_number, group_id, group_name, registered_by)
// VALUES ($1, $2, $3, $4, $5, $6)
// RETURNING *

// Prisma:
const newConvert = await prisma.newConvert.create({
  data: {
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
    groupId: 'group-id',
    groupName: 'January',
    registeredById: 'user-id',
  },
})

// ============================================================================
// EXAMPLE 6: UPDATE
// ============================================================================

// SQL:
// UPDATE progress_records 
// SET is_completed = true, date_completed = NOW(), updated_by = $2
// WHERE person_id = $1 AND stage_number = $3

// Prisma:
await prisma.progressRecord.update({
  where: {
    personId_stageNumber: {
      personId: 'person-id',
      stageNumber: 18,
    },
  },
  data: {
    isCompleted: true,
    dateCompleted: new Date(),
    updatedById: 'user-id',
  },
})

// ============================================================================
// EXAMPLE 7: DELETE (Soft Delete)
// ============================================================================

// SQL:
// UPDATE users SET deleted_at = NOW() WHERE id = $1

// Prisma:
await prisma.user.update({
  where: { id: 'user-id' },
  data: { deletedAt: new Date() },
})

// ============================================================================
// EXAMPLE 8: Bulk INSERT
// ============================================================================

// SQL:
// INSERT INTO progress_records (person_id, stage_number, stage_name, updated_by)
// VALUES ($1, 1, 'Stage 1', $2), ($1, 2, 'Stage 2', $2), ($1, 3, 'Stage 3', $2)

// Prisma:
await prisma.progressRecord.createMany({
  data: [
    { personId: 'person-id', stageNumber: 1, stageName: 'Stage 1', updatedById: 'user-id' },
    { personId: 'person-id', stageNumber: 2, stageName: 'Stage 2', updatedById: 'user-id' },
    { personId: 'person-id', stageNumber: 3, stageName: 'Stage 3', updatedById: 'user-id' },
  ],
})

// ============================================================================
// EXAMPLE 9: Transaction
// ============================================================================

// SQL:
// BEGIN;
// INSERT INTO new_converts (...) VALUES (...) RETURNING id;
// INSERT INTO progress_records (...) VALUES (...);
// COMMIT;

// Prisma:
const milestones = [
  { stageNumber: 1, stageName: 'Stage 1' },
  { stageNumber: 2, stageName: 'Stage 2' },
];

await prisma.$transaction(async (tx) => {
  const convert = await tx.newConvert.create({
    data: {
      firstName: 'Jane',
      lastName: 'Smith',
      phoneNumber: '+9876543210',
      groupName: 'January',
      registeredById: 'user-id',
    },
  })

  await tx.progressRecord.createMany({
    data: milestones.map((m) => ({
      personId: convert.id,
      stageNumber: m.stageNumber,
      stageName: m.stageName,
      updatedById: 'user-id',
    })),
  })
})

// ============================================================================
// EXAMPLE 10: Search with LIKE
// ============================================================================

// SQL:
// SELECT * FROM new_converts 
// WHERE first_name ILIKE '%john%' OR last_name ILIKE '%john%'

// Prisma:
const searchResults = await prisma.newConvert.findMany({
  where: {
    OR: [
      { firstName: { contains: 'john', mode: 'insensitive' } },
      { lastName: { contains: 'john', mode: 'insensitive' } },
    ],
  },
})

// ============================================================================
// EXAMPLE 11: Attendance with Date Range
// ============================================================================

// SQL:
// SELECT COUNT(*) as attendance_count
// FROM attendance_records
// WHERE person_id = $1 AND attendance_date >= $2 AND attendance_date <= $3

// Prisma:
const attendanceCount = await prisma.attendanceRecord.count({
  where: {
    personId: 'person-id',
    attendanceDate: {
      gte: new Date('2025-01-01'),
      lte: new Date('2025-12-31'),
    },
  },
})

// ============================================================================
// EXAMPLE 12: Nested Relations
// ============================================================================

// SQL (Multiple queries):
// SELECT * FROM groups WHERE id = $1;
// SELECT * FROM users WHERE group_id = $1;
// SELECT * FROM new_converts WHERE group_id = $1;

// Prisma (Single query):
const groupWithData = await prisma.group.findUnique({
  where: { id: 'group-id' },
  include: {
    leader: true,
    users: {
      include: {
        user: true,
      },
    },
    newConverts: {
      include: {
        progressRecords: {
          where: { isCompleted: true },
        },
      },
    },
  },
})

// ============================================================================
// EXAMPLE 13: Aggregations
// ============================================================================

// SQL:
// SELECT 
//   COUNT(*) as total,
//   COUNT(*) FILTER (WHERE is_completed = true) as completed,
//   AVG(CASE WHEN is_completed THEN 1 ELSE 0 END) * 100 as completion_rate
// FROM progress_records
// WHERE person_id = $1

// Prisma:
const stats = await prisma.progressRecord.aggregate({
  where: { personId: 'person-id' },
  _count: {
    _all: true,
  },
})

const completedStats = await prisma.progressRecord.count({
  where: {
    personId: 'person-id',
    isCompleted: true,
  },
})

const completionRate = (completedStats / stats._count._all) * 100

// ============================================================================
// TIPS
// ============================================================================

/*
1. Use `include` to fetch related data (JOINs)
2. Use `select` to choose specific fields
3. Use `where` for filtering (WHERE clauses)
4. Use `orderBy` for sorting (ORDER BY)
5. Use `take` and `skip` for pagination (LIMIT/OFFSET)
6. Use `_count`, `_sum`, `_avg`, `_min`, `_max` for aggregations
7. Use `$transaction` for atomic operations
8. Use `createMany` for bulk inserts (faster than multiple creates)
9. Use `updateMany` or `deleteMany` for bulk operations
10. Use `findFirst` when you expect one result
11. Use `findMany` when you expect multiple results
12. Use `findUnique` when querying by unique field (id, email, etc.)
*/

export {}
