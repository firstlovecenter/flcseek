import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    // Only skaduteye and sysadmin can edit database
    if (!userPayload || userPayload.role !== 'superadmin' || !['skaduteye', 'sysadmin'].includes(userPayload.username)) {
      return NextResponse.json(
        { error: 'Unauthorized. Only skaduteye and sysadmin can edit database records.' },
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
    const allowedTables = ['users', 'groups', 'new_converts', 'progress_records', 'attendance_records', 'milestones', 'departments'];
    if (!allowedTables.includes(tableName)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    // Build UPDATE query dynamically
    const columns = Object.keys(updates);
    const values = Object.values(updates);
    
    // Create SET clause
    const setClause = columns.map((col, idx) => `${col} = $${idx + 1}`).join(', ');
    
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

    const result = await query(updateQuery, [...values, id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Record updated successfully',
      record: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error updating record:', error);
    return NextResponse.json(
      { error: 'Failed to update record', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    // Only skaduteye and sysadmin can delete database records
    if (!userPayload || userPayload.role !== 'superadmin' || !['skaduteye', 'sysadmin'].includes(userPayload.username)) {
      return NextResponse.json(
        { error: 'Unauthorized. Only skaduteye and sysadmin can delete database records.' },
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
    const allowedTables = ['users', 'groups', 'new_converts', 'progress_records', 'attendance_records', 'milestones', 'departments'];
    if (!allowedTables.includes(tableName)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    // Determine which ID column to use
    let idColumn = 'id';
    if (tableName === 'milestones') {
      idColumn = 'stage_number';
    }

    const deleteQuery = `DELETE FROM ${tableName} WHERE ${idColumn} = $1 RETURNING *`;
    const result = await query(deleteQuery, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Record deleted successfully',
      record: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error deleting record:', error);
    return NextResponse.json(
      { error: 'Failed to delete record', details: error.message },
      { status: 500 }
    );
  }
}
