import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = verifySuperAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get counts for each table using Prisma
    const [usersCount, groupsCount, peopleCount, progressCount, attendanceCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.group.count(),
        prisma.newConvert.count(),
        prisma.progressRecord.count(),
        prisma.attendanceRecord.count(),
      ]);

    const tables = {
      users: usersCount,
      groups: groupsCount,
      new_converts: peopleCount,
      progress_records: progressCount,
      attendance_records: attendanceCount,
    };

    const totalRecords = Object.values(tables).reduce(
      (sum, count) => sum + count,
      0
    );

    return NextResponse.json({
      tables,
      totalRecords,
    });
  } catch (error) {
    console.error('Error fetching database info:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
