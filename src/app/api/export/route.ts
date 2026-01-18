import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { logAuditEvent, extractRequestInfo } from '@/lib/audit-log';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/export
 * Export data to JSON (can be converted to Excel/CSV on client)
 * 
 * Query params:
 * - type: 'converts' | 'progress' | 'attendance' | 'all'
 * - group_id: Filter by group
 * - format: 'json' | 'csv' (default: json)
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only superadmin and leadpastor can export data
    if (!['superadmin', 'leadpastor'].includes(userPayload.role)) {
      return NextResponse.json(
        { error: 'Only superadmin and lead pastor can export data' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get('type') || 'converts';
    const groupId = searchParams.get('group_id');
    const format = searchParams.get('format') || 'json';

    const { ipAddress, userAgent } = extractRequestInfo(request.headers);

    const data: Record<string, unknown[]> = {};

    // Build filter conditions
    const groupFilter = groupId ? { groupId } : {};

    // Export converts
    if (exportType === 'converts' || exportType === 'all') {
      const converts = await prisma.newConvert.findMany({
        where: groupFilter,
        include: {
          group: { select: { name: true, year: true } },
          registeredBy: { select: { firstName: true, lastName: true } }
        },
        orderBy: [
          { group: { name: 'asc' } },
          { firstName: 'asc' }
        ]
      });

      data.converts = converts.map((nc: any) => ({
        id: nc.id,
        first_name: nc.firstName,
        last_name: nc.lastName,
        phone_number: nc.phoneNumber,
        date_of_birth: nc.dateOfBirth,
        gender: nc.gender,
        residential_location: nc.residentialLocation,
        school_residential_location: nc.schoolResidentialLocation,
        occupation_type: nc.occupationType,
        group_name: nc.group?.name || null,
        group_year: nc.group?.year || null,
        registered_at: nc.createdAt,
        registered_by: nc.registeredBy
          ? `${nc.registeredBy.firstName || ''} ${nc.registeredBy.lastName || ''}`.trim()
          : null,
      }));
    }

    // Export progress
    if (exportType === 'progress' || exportType === 'all') {
      const milestones = await prisma.milestone.findMany({
        orderBy: { stageNumber: 'asc' }
      });

      const converts = await prisma.newConvert.findMany({
        where: groupFilter,
        include: {
          group: { select: { name: true, year: true } },
          progressRecords: true,
        },
        orderBy: [
          { group: { name: 'asc' } },
          { firstName: 'asc' }
        ]
      });

      const progressData: unknown[] = [];
      for (const nc of converts) {
        for (const m of milestones) {
          const pr = nc.progressRecords.find(p => p.stageNumber === m.stageNumber);
          progressData.push({
            first_name: nc.firstName,
            last_name: nc.lastName,
            phone_number: nc.phoneNumber,
            group_name: nc.group?.name || null,
            group_year: nc.group?.year || null,
            stage_number: m.stageNumber,
            stage_name: m.stageName,
            is_completed: pr?.isCompleted || false,
            date_completed: pr?.dateCompleted || null,
          });
        }
      }
      data.progress = progressData;
    }

    // Export attendance
    if (exportType === 'attendance' || exportType === 'all') {
      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: groupFilter ? { person: groupFilter } : {},
        include: {
          person: {
            include: {
              group: { select: { name: true, year: true } }
            }
          },
          markedBy: { select: { firstName: true, lastName: true } }
        },
        orderBy: [
          { attendanceDate: 'desc' },
          { person: { firstName: 'asc' } }
        ]
      });

      data.attendance = attendanceRecords.map(ar => ({
        first_name: ar.person.firstName,
        last_name: ar.person.lastName,
        phone_number: ar.person.phoneNumber,
        group_name: ar.person.group?.name || null,
        group_year: ar.person.group?.year || null,
        attendance_date: ar.attendanceDate,
        marked_by: ar.markedBy
          ? `${ar.markedBy.firstName || ''} ${ar.markedBy.lastName || ''}`.trim()
          : null,
      }));
    }

    // Export summary stats
    if (exportType === 'all') {
      const groups = await prisma.group.findMany({
        include: {
          _count: {
            select: { newConverts: true }
          },
          newConverts: {
            include: {
              progressRecords: { where: { isCompleted: true } },
              attendanceRecords: true,
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      data.summary = groups.map(g => ({
        group_name: g.name,
        group_year: g.year,
        total_converts: g._count.newConverts,
        completed_milestones: g.newConverts.reduce(
          (sum, nc) => sum + nc.progressRecords.length, 0
        ),
        total_attendance_records: g.newConverts.reduce(
          (sum, nc) => sum + nc.attendanceRecords.length, 0
        ),
      }));
    }

    // Log export action
    await logAuditEvent({
      userId: userPayload.id,
      action: 'EXPORT_DATA',
      newValues: { type: exportType, group_id: groupId, format },
      ipAddress,
      userAgent,
    });

    // Handle CSV format
    if (format === 'csv') {
      const csvData = convertToCSV(data);
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="flcseek-export-${exportType}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Default JSON format
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      exportedBy: userPayload.username,
      filters: { type: exportType, group_id: groupId },
      data,
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Convert data object to CSV format
 */
function convertToCSV(data: Record<string, unknown[]>): string {
  const lines: string[] = [];

  for (const [key, rows] of Object.entries(data)) {
    if (!Array.isArray(rows) || rows.length === 0) continue;

    // Add section header
    lines.push(`\n=== ${key.toUpperCase()} ===`);

    // Get headers from first row
    const headers = Object.keys(rows[0] as Record<string, unknown>);
    lines.push(headers.join(','));

    // Add data rows
    for (const row of rows) {
      const rowObj = row as Record<string, unknown>;
      const values = headers.map((h) => {
        const val = rowObj[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        // Escape quotes and wrap in quotes if contains comma
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      lines.push(values.join(','));
    }
  }

  return lines.join('\n');
}
