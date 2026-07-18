import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedAuthUser } from '@/lib/api/middleware';

export async function GET(request: NextRequest) {
  try {
    const userPayload = await getVerifiedAuthUser(request);

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all tables and their columns using raw query (information_schema is not available via Prisma models)
    // Cast name columns to text to avoid Prisma deserialization errors on the 'name' type
    const tablesResult = await prisma.$queryRawUnsafe<
      Array<{
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
        ordinal_position: number;
      }>
    >(`
      SELECT 
        table_name::text AS table_name,
        column_name::text AS column_name,
        data_type::text AS data_type,
        is_nullable::text AS is_nullable,
        column_default::text AS column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name IN (
        'users',
        'groups',
        'new_converts',
        'progress_records',
        'attendance_records',
        'milestones',
        'user_groups',
        'activity_logs',
        'notifications',
        'password_reset_tokens',
        'rate_limit_records'
      )
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
