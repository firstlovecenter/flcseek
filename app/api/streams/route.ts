import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// GET /api/streams - Fetch all streams
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Lead pastor and super admin can view all streams
    // Stream leaders can only view their own stream
    let sql = `
      SELECT 
        s.id,
        s.name,
        s.description,
        s.stream_leader_id,
        s.created_at,
        s.updated_at,
        u.username as stream_leader_name,
        (SELECT COUNT(*) FROM groups WHERE stream_id = s.id AND is_active = true) as active_groups_count,
        (SELECT COALESCE(SUM(
          (SELECT COUNT(*) FROM registered_people WHERE group_id = g.id)
        ), 0) FROM groups g WHERE g.stream_id = s.id) as members_count
      FROM streams s
      LEFT JOIN users u ON s.stream_leader_id = u.id
    `;

    // Filter by stream for stream leaders
    if (userPayload.role === 'stream_leader') {
      const userResult = await query(
        'SELECT stream_id FROM users WHERE id = $1',
        [userPayload.userId]
      );
      
      if (userResult.rows.length === 0 || !userResult.rows[0].stream_id) {
        return NextResponse.json({ error: 'No stream assigned' }, { status: 403 });
      }

      sql += ' WHERE s.id = $1';
      const result = await query(sql, [userResult.rows[0].stream_id]);
      return NextResponse.json(result.rows);
    }

    // Super admin and lead pastor can see all
    if (userPayload.role === 'super_admin' || userPayload.role === 'lead_pastor') {
      sql += ' ORDER BY s.name';
      const result = await query(sql);
      return NextResponse.json(result.rows);
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (error) {
    console.error('Error fetching streams:', error);
    return NextResponse.json({ error: 'Failed to fetch streams' }, { status: 500 });
  }
}

// POST /api/streams - Create a new stream
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, stream_leader_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'Stream name is required' }, { status: 400 });
    }

    // Validate stream leader if provided
    if (stream_leader_id) {
      const leaderCheck = await query(
        'SELECT id, role FROM users WHERE id = $1',
        [stream_leader_id]
      );

      if (leaderCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Stream leader not found' }, { status: 404 });
      }

      if (leaderCheck.rows[0].role !== 'stream_leader') {
        return NextResponse.json(
          { error: 'User must have stream_leader role' },
          { status: 400 }
        );
      }
    }

    const result = await query(
      `INSERT INTO streams (name, description, stream_leader_id) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [name, description || null, stream_leader_id || null]
    );

    // Update the stream leader's stream_id
    if (stream_leader_id) {
      await query(
        'UPDATE users SET stream_id = $1 WHERE id = $2',
        [result.rows[0].id, stream_leader_id]
      );
    }

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating stream:', error);
    
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Stream name already exists' }, { status: 409 });
    }
    
    return NextResponse.json({ error: 'Failed to create stream' }, { status: 500 });
  }
}
