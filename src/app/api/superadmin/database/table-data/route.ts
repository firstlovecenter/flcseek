import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
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
      return NextResponse.json(
        { error: 'Table name is required' },
        { status: 400 }
      );
    }

    // Validate table name to prevent SQL injection
    const allowedTables = [
      'users',
      'groups',
      'new_converts',
      'progress_records',
      'attendance_records',
      'milestones',
      'departments',
    ];
    if (!allowedTables.includes(tableName)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    // Determine order by clause
    let orderByClause = 'id';
    if (tableName === 'milestones') {
      orderByClause = 'stage_number';
    } else if (tableName === 'progress_records') {
      orderByClause = 'person_id, stage_number';
    } else if (tableName === 'attendance_records') {
      orderByClause = 'date_attended DESC, person_id';
    }

    // Use raw query since we need dynamic table names
    const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM ${tableName}`
    );
    const total = Number(countResult[0].count);

    const dataResult = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM ${tableName} ORDER BY ${orderByClause} LIMIT $1 OFFSET $2`,
      limit,
      offset
    );

    // Convert BigInt to Number for JSON serialization
    const data = dataResult.map((row) => {
      const converted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        converted[key] = typeof value === 'bigint' ? Number(value) : value;
      }
      return converted;
    });

    return NextResponse.json({
      data,
      total,
      limit,
      offset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching table data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch table data', details: message },
      { status: 500 }
    );
  }
}
