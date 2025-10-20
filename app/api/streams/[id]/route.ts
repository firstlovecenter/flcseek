import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// GET /api/streams/[id] - Fetch a single stream
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await query(
      `SELECT 
        s.id,
        s.name,
        s.description,
        s.stream_leader_id,
        s.created_at,
        s.updated_at,
        u.username as stream_leader_name
       FROM streams s
       LEFT JOIN users u ON s.stream_leader_id = u.id
       WHERE s.id = $1`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching stream:', error);
    return NextResponse.json({ error: 'Failed to fetch stream' }, { status: 500 });
  }
}

// PUT /api/streams/[id] - Update a stream
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, stream_leader_id } = body;

    // Check if stream exists
    const streamCheck = await query('SELECT * FROM streams WHERE id = $1', [params.id]);
    if (streamCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }

    const oldStreamLeaderId = streamCheck.rows[0].stream_leader_id;

    // Validate new stream leader if provided
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
      `UPDATE streams 
       SET name = $1, description = $2, stream_leader_id = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [name, description || null, stream_leader_id || null, params.id]
    );

    // Update stream_id for the new leader
    if (stream_leader_id && stream_leader_id !== oldStreamLeaderId) {
      // Remove stream from old leader
      if (oldStreamLeaderId) {
        await query(
          'UPDATE users SET stream_id = NULL WHERE id = $1',
          [oldStreamLeaderId]
        );
      }
      
      // Assign stream to new leader
      await query(
        'UPDATE users SET stream_id = $1 WHERE id = $2',
        [params.id, stream_leader_id]
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating stream:', error);
    
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Stream name already exists' }, { status: 409 });
    }
    
    return NextResponse.json({ error: 'Failed to update stream' }, { status: 500 });
  }
}

// DELETE /api/streams/[id] - Delete a stream
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if stream has active groups
    const groupsCheck = await query(
      'SELECT COUNT(*) as count FROM groups WHERE stream_id = $1 AND is_active = true',
      [params.id]
    );

    if (parseInt(groupsCheck.rows[0].count) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete stream with active groups' },
        { status: 400 }
      );
    }

    // Delete the stream (cascade will handle relationships)
    const result = await query('DELETE FROM streams WHERE id = $1 RETURNING *', [params.id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Stream deleted successfully' });
  } catch (error) {
    console.error('Error deleting stream:', error);
    return NextResponse.json({ error: 'Failed to delete stream' }, { status: 500 });
  }
}
