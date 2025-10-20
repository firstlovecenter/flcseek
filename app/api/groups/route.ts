import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// GET /api/groups - List all groups
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userPayload = verifyToken(token);
    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get stream_id filter from query params
    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('stream_id');

    let sql = `
      SELECT 
        g.id,
        g.name,
        g.description,
        g.sheep_seeker_id as leader_id,
        g.stream_id,
        g.start_date,
        g.end_date,
        g.is_active,
        g.created_at,
        g.updated_at,
        u.username as leader_username,
        s.name as stream_name,
        (SELECT COUNT(*) FROM registered_people WHERE group_id = g.id) as member_count
      FROM groups g
      LEFT JOIN users u ON g.sheep_seeker_id = u.id
      LEFT JOIN streams s ON g.stream_id = s.id
    `;

    const params: any[] = [];

    // Stream leaders can only see their stream's groups
    if (userPayload.role === 'stream_leader') {
      const userResult = await query(
        'SELECT stream_id FROM users WHERE id = $1',
        [userPayload.id]
      );
      
      if (userResult.rows.length === 0 || !userResult.rows[0].stream_id) {
        return NextResponse.json({ error: 'No stream assigned' }, { status: 403 });
      }

      sql += ' WHERE g.stream_id = $1';
      params.push(userResult.rows[0].stream_id);
    } else if (streamId && (userPayload.role === 'super_admin' || userPayload.role === 'lead_pastor')) {
      // Super admin and lead pastor can filter by stream
      sql += ' WHERE g.stream_id = $1';
      params.push(streamId);
    }

    sql += ' ORDER BY g.is_active DESC, g.name ASC';

    const result = params.length > 0 
      ? await query(sql, params)
      : await query(sql);

    return NextResponse.json({ groups: result.rows });
  } catch (error: any) {
    console.error('Error fetching groups:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/groups - Create a new group
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userPayload = verifyToken(token);
    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only super_admin and stream_leader can create groups
    if (userPayload.role !== 'super_admin' && userPayload.role !== 'stream_leader') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, sheep_seeker_id, stream_id, start_date } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      );
    }

    if (!stream_id) {
      return NextResponse.json(
        { error: 'Stream ID is required' },
        { status: 400 }
      );
    }

    // Stream leaders can only create groups in their own stream
    if (userPayload.role === 'stream_leader') {
      const userResult = await query(
        'SELECT stream_id FROM users WHERE id = $1',
        [userPayload.id]
      );
      
      if (userResult.rows.length === 0 || userResult.rows[0].stream_id !== stream_id) {
        return NextResponse.json({ error: 'Can only create groups in your own stream' }, { status: 403 });
      }
    }

    // Check if group name already exists in this stream
    const existing = await query(
      'SELECT id FROM groups WHERE name = $1 AND stream_id = $2',
      [name.trim(), stream_id]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Group name already exists in this stream' },
        { status: 409 }
      );
    }

    // If sheep_seeker_id is provided, verify the user exists
    if (sheep_seeker_id) {
      const userResult = await query(
        'SELECT id, role FROM users WHERE id = $1',
        [sheep_seeker_id]
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Sheep seeker not found' },
          { status: 404 }
        );
      }

      // Update user role to sheep_seeker if not already
      if (userResult.rows[0].role !== 'sheep_seeker') {
        await query(
          'UPDATE users SET role = $1, group_id = $2 WHERE id = $3',
          ['sheep_seeker', null, sheep_seeker_id] // Will update group_id after creation
        );
      }
    }

    // Calculate end_date (6 months from start_date)
    const groupStartDate = start_date || new Date().toISOString().split('T')[0];
    const startDateObj = new Date(groupStartDate);
    const endDateObj = new Date(startDateObj);
    endDateObj.setMonth(endDateObj.getMonth() + 6);
    const endDate = endDateObj.toISOString().split('T')[0];

    const result = await query(
      `INSERT INTO groups (name, description, sheep_seeker_id, stream_id, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name.trim(), description || null, sheep_seeker_id || null, stream_id, groupStartDate, endDate, true]
    );

    // Update sheep seeker's group_id
    if (sheep_seeker_id) {
      await query(
        'UPDATE users SET group_id = $1 WHERE id = $2',
        [result.rows[0].id, sheep_seeker_id]
      );
    }

    return NextResponse.json({
      message: 'Group created successfully',
      group: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error creating group:', error);
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Group name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
