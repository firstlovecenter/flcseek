import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyAdmin(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as { role: string };
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
    const converts = await prisma.newConvert.findMany({
      include: {
        registeredBy: {
          select: { username: true },
        },
        group: {
          select: { year: true },
        },
        _count: {
          select: {
            progressRecords: true,
            attendanceRecords: true,
          },
        },
        progressRecords: {
          where: { isCompleted: true },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

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
      'Total Attendance',
    ];

    const csvRows = [headers.join(',')];

    for (const convert of converts) {
      const fullName = `${convert.firstName || ''} ${convert.lastName || ''}`.trim();
      const row = [
        `"${fullName}"`,
        `"${convert.firstName || ''}"`,
        `"${convert.lastName || ''}"`,
        `"${convert.phoneNumber || ''}"`,
        `"${convert.gender || ''}"`,
        `"${convert.dateOfBirth || ''}"`,
        `"${convert.residentialLocation || ''}"`,
        `"${convert.schoolResidentialLocation || ''}"`,
        `"${convert.occupationType || ''}"`,
        `"${convert.groupName || ''}"`,
        `"${convert.group?.year || ''}"`,
        `"${convert.createdAt ? new Date(convert.createdAt).toLocaleDateString() : ''}"`,
        `"${convert.registeredBy?.username || ''}"`,
        convert.progressRecords.length,
        convert._count.attendanceRecords,
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
  } catch (error) {
    console.error('Error exporting converts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
