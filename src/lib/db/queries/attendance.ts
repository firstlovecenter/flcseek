/**
 * Attendance Records Database Queries - Prisma ORM
 * All database operations for the attendance_records table
 */

import { prisma } from '@/lib/prisma';
import { ATTENDANCE_GOAL } from '@/lib/constants';

// Type definitions
export interface AttendanceRecord {
  id: string;
  person_id: string;
  date_attended: string;
  recorded_by?: string;
  created_at: string;
}

export interface CreateAttendanceInput {
  person_id: string;
  date_attended: string;
  recorded_by: string;
}

export interface AttendanceFilters {
  personId?: string;
  groupId?: string;
  groupName?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Helper to transform Prisma attendance record to snake_case format
 */
function transformAttendanceRecord(a: {
  id: string;
  personId: string;
  attendanceDate: Date;
  markedById: string;
  createdAt: Date | null;
}): AttendanceRecord {
  return {
    id: a.id,
    person_id: a.personId,
    date_attended: a.attendanceDate.toISOString().split('T')[0],
    recorded_by: a.markedById,
    created_at: a.createdAt?.toISOString() || new Date().toISOString(),
  };
}

/**
 * Get attendance records with optional filters
 */
export async function findMany(filters: AttendanceFilters = {}): Promise<AttendanceRecord[]> {
  const where: Record<string, any> = {};

  if (filters.personId) {
    where.personId = filters.personId;
  }

  // Scope by the convert's group. groupId targets a single group instance;
  // groupName targets a month name across all years (role-based scoping).
  if (filters.groupId || filters.groupName) {
    const personFilter: Record<string, unknown> = {};
    if (filters.groupId) personFilter.groupId = filters.groupId;
    if (filters.groupName) personFilter.group = { name: filters.groupName };
    where.person = personFilter;
  }

  if (filters.startDate) {
    where.attendanceDate = {
      ...((where.attendanceDate as Record<string, any>) || {}),
      gte: new Date(filters.startDate),
    };
  }

  if (filters.endDate) {
    where.attendanceDate = {
      ...((where.attendanceDate as Record<string, any>) || {}),
      lte: new Date(filters.endDate),
    };
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'desc' }],
    take: filters.limit,
    skip: filters.offset,
  });

  return records.map(transformAttendanceRecord);
}

/**
 * Get attendance for a specific person
 */
export async function findByPersonId(personId: string): Promise<AttendanceRecord[]> {
  return findMany({ personId });
}

/**
 * Get attendance count for a person
 */
export async function getCountForPerson(personId: string): Promise<number> {
  return prisma.attendanceRecord.count({
    where: { personId },
  });
}

/**
 * Record attendance for a person
 */
export async function create(input: CreateAttendanceInput): Promise<AttendanceRecord> {
  const record = await prisma.attendanceRecord.create({
    data: {
      personId: input.person_id,
      attendanceDate: new Date(input.date_attended),
      markedById: input.recorded_by,
    },
  });

  await updateAttendanceMilestones([input]);

  return transformAttendanceRecord(record);
}

/**
 * Bulk record attendance for multiple people.
 *
 * Previously this ran 3+ queries per record (findFirst + create + a count-based
 * milestone update). It now batches the work:
 *  1. one query to detect existing (duplicate) person/date pairs
 *  2. one `createManyAndReturn` insert for all new records
 *  3. one grouped count + targeted milestone upserts for affected converts
 */
export async function createMany(
  records: CreateAttendanceInput[]
): Promise<{ created: AttendanceRecord[]; errors: string[] }> {
  const created: AttendanceRecord[] = [];
  const errors: string[] = [];

  if (records.length === 0) {
    return { created, errors };
  }

  const personIds = Array.from(new Set(records.map((r) => r.person_id)));
  const dates = Array.from(new Set(records.map((r) => r.date_attended)));

  // 1. Single query to find already-recorded (person, date) pairs.
  const existing = await prisma.attendanceRecord.findMany({
    where: {
      personId: { in: personIds },
      attendanceDate: { in: dates.map((d) => new Date(d)) },
    },
    select: { personId: true, attendanceDate: true },
  });

  const keyOf = (personId: string, date: string) => `${personId}|${date}`;
  const existingKeys = new Set(
    existing.map((e) => keyOf(e.personId, e.attendanceDate.toISOString().split('T')[0]))
  );

  // Partition into inserts vs. duplicate errors (also dedupe within the batch).
  const seen = new Set<string>();
  const toCreate: CreateAttendanceInput[] = [];
  for (const record of records) {
    const key = keyOf(record.person_id, record.date_attended);
    if (existingKeys.has(key) || seen.has(key)) {
      errors.push(
        `Attendance already recorded for ${record.person_id} on ${record.date_attended}`
      );
      continue;
    }
    seen.add(key);
    toCreate.push(record);
  }

  if (toCreate.length === 0) {
    return { created, errors };
  }

  // 2. Single batched insert that returns the created rows.
  try {
    const newRecords = await prisma.attendanceRecord.createManyAndReturn({
      data: toCreate.map((r) => ({
        personId: r.person_id,
        attendanceDate: new Date(r.date_attended),
        markedById: r.recorded_by,
      })),
      // The DB now enforces UNIQUE (person_id, date_attended); if a concurrent
      // request wins the race after our duplicate pre-check, skip silently
      // instead of failing the whole batch.
      skipDuplicates: true,
    });
    for (const row of newRecords) {
      created.push(transformAttendanceRecord(row));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    errors.push(`Failed to record attendance batch: ${message}`);
    return { created, errors };
  }

  // 3. Recompute the attendance milestone (stage 18) for affected converts in one pass.
  await updateAttendanceMilestones(toCreate);

  return { created, errors };
}

/**
 * Mark the attendance milestone (stage 18) complete for any of the given converts
 * whose total attendance has reached ATTENDANCE_GOAL. Uses a single grouped count
 * instead of one count per convert.
 */
async function updateAttendanceMilestones(records: CreateAttendanceInput[]): Promise<void> {
  const personIds = Array.from(new Set(records.map((r) => r.person_id)));
  if (personIds.length === 0) return;

  const counts = await prisma.attendanceRecord.groupBy({
    by: ['personId'],
    where: { personId: { in: personIds } },
    _count: { _all: true },
  });

  const updatedByFor = new Map(records.map((r) => [r.person_id, r.recorded_by]));

  const reached = counts.filter((c) => c._count._all >= ATTENDANCE_GOAL);
  for (const c of reached) {
    const updatedById = updatedByFor.get(c.personId);
    if (!updatedById) continue;
    await prisma.progressRecord.upsert({
      where: { personId_stageNumber: { personId: c.personId, stageNumber: 18 } },
      create: {
        personId: c.personId,
        stageNumber: 18,
        stageName: 'Attendance',
        isCompleted: true,
        dateCompleted: new Date(),
        updatedById,
      },
      update: {
        isCompleted: true,
        dateCompleted: new Date(),
        updatedById,
      },
    });
  }
}

/**
 * Delete an attendance record
 */
export async function remove(id: string): Promise<boolean> {
  try {
    await prisma.attendanceRecord.delete({ where: { id } });
    return true;
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return false;
    }
    throw error;
  }
}

/**
 * Get attendance stats for a group
 */
export async function getGroupStats(groupId: string): Promise<{
  total_people: number;
  with_attendance: number;
  goal_reached: number;
  average_attendance: number;
}> {
  const [totalPeople, peopleWithAttendance] = await Promise.all([
    prisma.newConvert.count({ where: { groupId } }),
    prisma.newConvert.findMany({
      where: { groupId },
      include: {
        _count: { select: { attendanceRecords: true } },
      },
    }),
  ]);

  const withAttendance = peopleWithAttendance.filter(
    (p) => p._count.attendanceRecords > 0
  ).length;
  const goalReached = peopleWithAttendance.filter(
    (p) => p._count.attendanceRecords >= ATTENDANCE_GOAL
  ).length;
  const totalAttendance = peopleWithAttendance.reduce(
    (sum, p) => sum + p._count.attendanceRecords,
    0
  );

  return {
    total_people: totalPeople,
    with_attendance: withAttendance,
    goal_reached: goalReached,
    average_attendance:
      totalPeople > 0 ? Math.round(totalAttendance / totalPeople) : 0,
  };
}

/**
 * Get attendance by week for analytics
 */
export async function getWeeklyStats(
  groupId?: string,
  weeks: number = 12
): Promise<{ week: string; count: number }[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - weeks * 7);

  const where: Record<string, any> = {
    attendanceDate: { gte: startDate },
  };

  if (groupId) {
    where.person = { groupId };
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    select: { attendanceDate: true },
  });

  // Group by week
  const weekCounts = new Map<string, number>();
  for (const record of records) {
    const date = new Date(record.attendanceDate);
    // Get Monday of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(date.setDate(diff));
    const weekKey = weekStart.toISOString().split('T')[0];

    weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1);
  }

  // Convert to array and sort by week descending
  return Array.from(weekCounts.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => b.week.localeCompare(a.week));
}
