import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all tables and their columns
    const tablesResult = await query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'groups', 'new_converts', 'progress_records', 'attendance_records', 'milestones', 'departments')
      ORDER BY table_name, ordinal_position
    `);

    // Group columns by table
    const schema: Record<string, any[]> = {};
    tablesResult.rows.forEach((row) => {
      if (!schema[row.table_name]) {
        schema[row.table_name] = [];
      }
      schema[row.table_name].push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        default: row.column_default,
        position: row.ordinal_position,
      });
    });

    return NextResponse.json({ schema });
  } catch (error: any) {
    console.error('Error fetching database schema:', error);
    return NextResponse.json(
      { error: 'Failed to fetch database schema', details: error.message },
      { status: 500 }
    );
  }
}
