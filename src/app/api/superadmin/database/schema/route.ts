import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all tables and their columns using raw query (information_schema is not available via Prisma models)
    const tablesResult = await prisma.$queryRaw<
      Array<{
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
        ordinal_position: number;
      }>
    >(Prisma.sql`
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
    const schema: Record<
      string,
      Array<{
        name: string;
        type: string;
        nullable: boolean;
        default: string | null;
        position: number;
      }>
    > = {};
    tablesResult.forEach((row) => {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching database schema:', error);
    return NextResponse.json(
      { error: 'Failed to fetch database schema', details: message },
      { status: 500 }
    );
  }
}
