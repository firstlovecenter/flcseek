import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'superadmin') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get counts for each table
    const usersCount = await query('SELECT COUNT(*) as count FROM users');
    const groupsCount = await query('SELECT COUNT(*) as count FROM groups');
    const peopleCount = await query('SELECT COUNT(*) as count FROM new_converts');
    const progressCount = await query('SELECT COUNT(*) as count FROM progress_records');
    const attendanceCount = await query('SELECT COUNT(*) as count FROM attendance_records');

    const tables = {
      users: parseInt(usersCount.rows[0]?.count || '0'),
      groups: parseInt(groupsCount.rows[0]?.count || '0'),
      new_converts: parseInt(peopleCount.rows[0]?.count || '0'),
      progress_records: parseInt(progressCount.rows[0]?.count || '0'),
      attendance_records: parseInt(attendanceCount.rows[0]?.count || '0'),
    };

    const totalRecords = Object.values(tables).reduce((sum, count) => sum + count, 0);

    return NextResponse.json({
      tables,
      totalRecords,
    });
  } catch (error) {
    console.error('Error fetching database info:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
