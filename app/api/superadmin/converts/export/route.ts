import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyAdmin(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'superadmin') return null;

    return decoded;
  } catch {
    return null;
  }
}

// GET - Export all converts to CSV
export async function GET(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT 
        CONCAT(rp.first_name, ' ', rp.last_name) as full_name,
        rp.first_name,
        rp.last_name,
        rp.phone_number,
        rp.gender,
        rp.date_of_birth,
        rp.residential_location,
        rp.school_residential_location,
        rp.occupation_type,
        rp.group_name,
        g.year as group_year,
        rp.created_at,
        u.username as registered_by,
        (SELECT COUNT(*) FROM progress_records pr WHERE pr.person_id = rp.id AND pr.is_completed = true) as completed_stages,
        (SELECT COUNT(*) FROM attendance_records ar WHERE ar.person_id = rp.id) as total_attendance
       FROM new_converts rp
       LEFT JOIN users u ON rp.registered_by = u.id
       LEFT JOIN groups g ON rp.group_id = g.id
       ORDER BY rp.created_at DESC`
    );

    const converts = result.rows;

    // Create CSV content
    const headers = [
      'Full Name',
      'First Name',
      'Last Name',
      'Phone Number',
      'Gender',
      'Date of Birth',
      'Residential Location',
      'School/Residential Location',
      'Occupation Type',
      'Group',
      'Year',
      'Registered Date',
      'Registered By',
      'Completed Stages',
      'Total Attendance'
    ];

    const csvRows = [headers.join(',')];

    for (const convert of converts) {
      const row = [
        `"${convert.full_name || ''}"`,
        `"${convert.first_name || ''}"`,
        `"${convert.last_name || ''}"`,
        `"${convert.phone_number || ''}"`,
        `"${convert.gender || ''}"`,
        `"${convert.date_of_birth || ''}"`,
        `"${convert.residential_location || ''}"`,
        `"${convert.school_residential_location || ''}"`,
        `"${convert.occupation_type || ''}"`,
        `"${convert.group_name || ''}"`,
        `"${convert.group_year || ''}"`,
        `"${convert.created_at ? new Date(convert.created_at).toLocaleDateString() : ''}"`,
        `"${convert.registered_by || ''}"`,
        convert.completed_stages || 0,
        convert.total_attendance || 0
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="new-converts-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting converts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
