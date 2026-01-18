/**
 * Attendance Records Database Queries - Prisma ORM
 * All database operations for the attendance_records table
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
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
  const where: Prisma.AttendanceRecordWhereInput = {};

  if (filters.personId) {
    where.personId = filters.personId;
  }

  if (filters.groupId) {
    where.person = { groupId: filters.groupId };
  }

  if (filters.startDate) {
    where.attendanceDate = {
      ...((where.attendanceDate as Prisma.DateTimeFilter) || {}),
      gte: new Date(filters.startDate),
    };
  }

  if (filters.endDate) {
    where.attendanceDate = {
      ...((where.attendanceDate as Prisma.DateTimeFilter) || {}),
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

  return transformAttendanceRecord(record);
}

/**
 * Bulk record attendance for multiple people
 */
export async function createMany(
  records: CreateAttendanceInput[]
): Promise<{ created: AttendanceRecord[]; errors: string[] }> {
  const created: AttendanceRecord[] = [];
  const errors: string[] = [];

  for (const record of records) {
    try {
      // Check for duplicate (same person, same date)
      const existing = await prisma.attendanceRecord.findFirst({
        where: {
          personId: record.person_id,
          attendanceDate: new Date(record.date_attended),
        },
      });

      if (existing) {
        errors.push(
          `Attendance already recorded for ${record.person_id} on ${record.date_attended}`
        );
        continue;
      }

      const newRecord = await prisma.attendanceRecord.create({
        data: {
          personId: record.person_id,
          attendanceDate: new Date(record.date_attended),
          markedById: record.recorded_by,
        },
      });

      created.push(transformAttendanceRecord(newRecord));

      // Check if this completes the attendance milestone
      await updateAttendanceMilestone(record.person_id, record.recorded_by);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Failed to record for ${record.person_id}: ${message}`);
    }
  }

  return { created, errors };
}

/**
 * Update attendance milestone (milestone 18) when threshold is reached
 */
async function updateAttendanceMilestone(personId: string, updatedById: string): Promise<void> {
  // Get current attendance count
  const attendanceCount = await prisma.attendanceRecord.count({
    where: { personId },
  });

  // Check if milestone 18 should be marked complete
  if (attendanceCount >= ATTENDANCE_GOAL) {
    await prisma.progressRecord.upsert({
      where: {
        personId_stageNumber: { personId, stageNumber: 18 },
      },
      create: {
        personId,
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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
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

  const where: Prisma.AttendanceRecordWhereInput = {
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
