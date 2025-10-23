import { NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userPayload = verifyToken(token);
    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get role filter from query params (for fetching stream_leaders, etc.)
    const url = new URL(request.url);
    const roleFilter = url.searchParams.get('role');

    let sql = `
      SELECT 
        u.id, 
        u.email, 
        u.username,
        u.first_name, 
        u.last_name, 
        u.phone_number, 
        u.role, 
        u.group_name,
        u.group_id,
        g.name as group_name_ref,
        u.created_at 
      FROM users u
      LEFT JOIN groups g ON u.group_id = g.id
    `;

    const params: any[] = [];

    // Only superadmin and leadpastor can view all users
    if (userPayload.role !== 'superadmin' && userPayload.role !== 'leadpastor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Apply role filter
    if (roleFilter) {
      if (params.length > 0) {
        sql += ` AND u.role = $${params.length + 1}`;
      } else {
        sql += ' WHERE u.role = $1';
      }
      params.push(roleFilter);
    }

    sql += ' ORDER BY COALESCE(NULLIF(u.first_name, \'\'), u.username) ASC, COALESCE(NULLIF(u.last_name, \'\'), \'\') ASC';

    const result = params.length > 0 
      ? await query(sql, params)
      : await query(sql);

    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
