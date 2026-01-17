import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
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
 * - year: Filter by year
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
    const year = searchParams.get('year');
    const format = searchParams.get('format') || 'json';

    const { ipAddress, userAgent } = extractRequestInfo(request.headers);

    let data: any = {};
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build filter conditions
    if (groupId) {
      conditions.push(`nc.group_id = $${paramIndex}`);
      params.push(groupId);
      paramIndex++;
    }
    if (year) {
      conditions.push(`g.year = $${paramIndex}`);
      params.push(parseInt(year));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Export converts
    if (exportType === 'converts' || exportType === 'all') {
      const convertsResult = await query(
        `SELECT 
          nc.id,
          nc.first_name,
          nc.last_name,
          nc.phone_number,
          nc.date_of_birth,
          nc.gender,
          nc.residential_location,
          nc.school_residential_location,
          nc.occupation_type,
          g.name as group_name,
          g.year as group_year,
          nc.created_at as registered_at,
          CONCAT(u.first_name, ' ', u.last_name) as registered_by
        FROM new_converts nc
        LEFT JOIN groups g ON nc.group_id = g.id
        LEFT JOIN users u ON nc.registered_by = u.id
        ${whereClause}
        ${conditions.length === 0 ? 'WHERE' : 'AND'} nc.deleted_at IS NULL
        ORDER BY g.year DESC, g.name, nc.first_name`,
        params
      );
      data.converts = convertsResult.rows;
    }

    // Export progress
    if (exportType === 'progress' || exportType === 'all') {
      const progressResult = await query(
        `SELECT 
          nc.first_name,
          nc.last_name,
          nc.phone_number,
          g.name as group_name,
          g.year as group_year,
          m.stage_number,
          m.stage_name,
          pr.is_completed,
          pr.date_completed
        FROM new_converts nc
        LEFT JOIN groups g ON nc.group_id = g.id
        CROSS JOIN milestones m
        LEFT JOIN progress_records pr ON nc.id = pr.person_id AND m.stage_number = pr.stage_number
        ${whereClause}
        ${conditions.length === 0 ? 'WHERE' : 'AND'} nc.deleted_at IS NULL AND m.is_active = true
        ORDER BY g.year DESC, g.name, nc.first_name, m.stage_number`,
        params
      );
      data.progress = progressResult.rows;
    }

    // Export attendance
    if (exportType === 'attendance' || exportType === 'all') {
      const attendanceResult = await query(
        `SELECT 
          nc.first_name,
          nc.last_name,
          nc.phone_number,
          g.name as group_name,
          g.year as group_year,
          ar.attendance_date,
          CONCAT(u.first_name, ' ', u.last_name) as marked_by
        FROM attendance_records ar
        JOIN new_converts nc ON ar.person_id = nc.id
        LEFT JOIN groups g ON nc.group_id = g.id
        LEFT JOIN users u ON ar.marked_by = u.id
        ${whereClause}
        ${conditions.length === 0 ? 'WHERE' : 'AND'} nc.deleted_at IS NULL
        ORDER BY ar.attendance_date DESC, nc.first_name`,
        params
      );
      data.attendance = attendanceResult.rows;
    }

    // Export summary stats
    if (exportType === 'all') {
      const summaryResult = await query(
        `SELECT 
          g.name as group_name,
          g.year as group_year,
          COUNT(DISTINCT nc.id) as total_converts,
          COUNT(DISTINCT CASE WHEN pr.is_completed THEN pr.id END) as completed_milestones,
          COUNT(DISTINCT ar.id) as total_attendance_records
        FROM groups g
        LEFT JOIN new_converts nc ON g.id = nc.group_id AND nc.deleted_at IS NULL
        LEFT JOIN progress_records pr ON nc.id = pr.person_id
        LEFT JOIN attendance_records ar ON nc.id = ar.person_id
        ${year ? 'WHERE g.year = $1' : ''}
        GROUP BY g.id, g.name, g.year
        ORDER BY g.year DESC, g.name`,
        year ? [parseInt(year)] : []
      );
      data.summary = summaryResult.rows;
    }

    // Log export action
    await logAuditEvent({
      userId: userPayload.id,
      action: 'EXPORT_DATA',
      newValues: { type: exportType, group_id: groupId, year, format },
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
      filters: { type: exportType, group_id: groupId, year },
      data,
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Convert data object to CSV format
 */
function convertToCSV(data: any): string {
  const lines: string[] = [];

  for (const [key, rows] of Object.entries(data)) {
    if (!Array.isArray(rows) || rows.length === 0) continue;

    // Add section header
    lines.push(`\n=== ${key.toUpperCase()} ===`);

    // Get headers from first row
    const headers = Object.keys(rows[0]);
    lines.push(headers.join(','));

    // Add data rows
    for (const row of rows) {
      const values = headers.map((h) => {
        const val = row[h];
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
