import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string };
    if (decoded.role !== 'superadmin') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// GET - List all converts (new_converts)
export async function GET(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const converts = await prisma.newConvert.findMany({
      include: {
        registeredBy: {
          select: { username: true }
        },
        group: {
          select: { year: true }
        },
        _count: {
          select: {
            progressRecords: true,
            attendanceRecords: true,
          }
        },
        progressRecords: {
          where: { isCompleted: true },
          select: { id: true }
        }
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    });

    const transformedConverts = converts.map(c => ({
      id: c.id,
      full_name: `${c.firstName} ${c.lastName}`.trim(),
      phone_number: c.phoneNumber,
      gender: c.gender,
      group_name: c.groupName,
      group_id: c.groupId,
      created_at: c.createdAt,
      group_year: c.group?.year || null,
      registered_by_name: c.registeredBy?.username || null,
      completed_stages: c.progressRecords.length,
      total_attendance: c._count.attendanceRecords,
    }));

    return NextResponse.json({ converts: transformedConverts });
  } catch (error) {
    console.error('Error fetching converts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
