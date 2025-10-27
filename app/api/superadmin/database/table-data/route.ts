import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tableName, limit = 100, offset = 0 } = await request.json();

    if (!tableName) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 });
    }

    // Validate table name to prevent SQL injection
    const allowedTables = ['users', 'groups', 'new_converts', 'progress_records', 'attendance_records', 'milestones', 'departments'];
    if (!allowedTables.includes(tableName)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    // Get total count
    const countResult = await query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const total = parseInt(countResult.rows[0].count);

    // Get data
    let orderByClause = 'id';
    if (tableName === 'milestones') {
      orderByClause = 'stage_number';
    } else if (tableName === 'progress_records' || tableName === 'attendance_records') {
      orderByClause = 'created_at DESC';
    }

    const dataResult = await query(`
      SELECT * FROM ${tableName}
      ORDER BY ${orderByClause}
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return NextResponse.json({
      data: dataResult.rows,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching table data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch table data', details: error.message },
      { status: 500 }
    );
  }
}
