import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    // Only skaduteye and sysadmin can edit database
    if (
      !userPayload ||
      userPayload.role !== 'superadmin' ||
      !['skaduteye', 'sysadmin'].includes(userPayload.username)
    ) {
      return NextResponse.json(
        {
          error:
            'Unauthorized. Only skaduteye and sysadmin can edit database records.',
        },
        { status: 403 }
      );
    }

    const { tableName, id, updates } = await request.json();

    if (!tableName || !id || !updates) {
      return NextResponse.json(
        { error: 'Table name, ID, and updates are required' },
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

    // Allowed columns per table — prevents attackers from updating arbitrary fields
    // (e.g. escalating privileges by writing to `role` or `password`).
    const allowedColumns: Record<string, string[]> = {
      users: ['first_name', 'last_name', 'email', 'phone_number', 'group_name', 'group_id', 'is_active'],
      groups: ['name', 'year', 'description', 'is_active', 'leader_id'],
      new_converts: [
        'first_name', 'last_name', 'phone_number', 'email', 'gender',
        'address', 'date_of_birth', 'occupation', 'group_name', 'group_id',
        'notes', 'is_active',
      ],
      progress_records: ['stage_number', 'completed', 'completed_at', 'notes'],
      attendance_records: ['attended', 'attended_at', 'notes'],
      milestones: ['stage_name', 'short_name', 'description', 'is_active', 'order_index'],
      departments: ['name', 'description', 'is_active'],
    };

    const permittedColumns = allowedColumns[tableName] ?? [];
    const columns = Object.keys(updates);
    const illegalColumns = columns.filter(col => !permittedColumns.includes(col));
    if (illegalColumns.length > 0) {
      return NextResponse.json(
        { error: `Column(s) not permitted for update: ${illegalColumns.join(', ')}` },
        { status: 400 }
      );
    }

    const values = Object.values(updates);

    // Create SET clause
    const setClause = columns
      .map((col, idx) => `${col} = $${idx + 1}`)
      .join(', ');

    // Determine which ID column to use
    let idColumn = 'id';
    if (tableName === 'milestones') {
      idColumn = 'stage_number';
    }

    const updateQuery = `
      UPDATE ${tableName}
      SET ${setClause}
      WHERE ${idColumn} = $${columns.length + 1}
      RETURNING *
    `;

    const result = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      updateQuery,
      ...values,
      id
    );

    if (result.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Convert BigInt to Number for JSON serialization
    const record: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result[0])) {
      record[key] = typeof value === 'bigint' ? Number(value) : value;
    }

    return NextResponse.json({
      message: 'Record updated successfully',
      record,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating record:', error);
    return NextResponse.json(
      { error: 'Failed to update record', details: message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    // Only skaduteye and sysadmin can delete database records
    if (
      !userPayload ||
      userPayload.role !== 'superadmin' ||
      !['skaduteye', 'sysadmin'].includes(userPayload.username)
    ) {
      return NextResponse.json(
        {
          error:
            'Unauthorized. Only skaduteye and sysadmin can delete database records.',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get('table');
    const id = searchParams.get('id');

    if (!tableName || !id) {
      return NextResponse.json(
        { error: 'Table name and ID are required' },
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

    // Determine which ID column to use
    let idColumn = 'id';
    if (tableName === 'milestones') {
      idColumn = 'stage_number';
    }

    const deleteQuery = `DELETE FROM ${tableName} WHERE ${idColumn} = $1 RETURNING *`;
    const result = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      deleteQuery,
      id
    );

    if (result.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Convert BigInt to Number for JSON serialization
    const record: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result[0])) {
      record[key] = typeof value === 'bigint' ? Number(value) : value;
    }

    return NextResponse.json({
      message: 'Record deleted successfully',
      record,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting record:', error);
    return NextResponse.json(
      { error: 'Failed to delete record', details: message },
      { status: 500 }
    );
  }
}
