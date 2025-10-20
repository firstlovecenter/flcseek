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
        u.stream_id,
        u.group_id,
        s.name as stream_name,
        g.name as group_name_ref,
        u.created_at 
      FROM users u
      LEFT JOIN streams s ON u.stream_id = s.id
      LEFT JOIN groups g ON u.group_id = g.id
    `;

    const params: any[] = [];

    // Only super_admin and stream_leaders can view users
    if (userPayload.role === 'stream_leader') {
      // Stream leaders can only see users in their stream
      const userResult = await query(
        'SELECT stream_id FROM users WHERE id = $1',
        [userPayload.id]
      );
      
      if (userResult.rows.length === 0 || !userResult.rows[0].stream_id) {
        return NextResponse.json({ error: 'No stream assigned' }, { status: 403 });
      }

      sql += ' WHERE u.stream_id = $1';
      params.push(userResult.rows[0].stream_id);
    } else if (userPayload.role !== 'super_admin' && userPayload.role !== 'lead_pastor') {
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

    sql += ' ORDER BY u.created_at DESC';

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
