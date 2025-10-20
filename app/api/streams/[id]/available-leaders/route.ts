import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// GET /api/streams/[id]/available-leaders - Get available sheep seekers for a stream
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

    // Stream leaders can only get leaders for their own stream
    if (userPayload.role === 'stream_leader') {
      const userResult = await query(
        'SELECT stream_id FROM users WHERE id = $1',
        [userPayload.id]
      );
      
      if (userResult.rows.length === 0 || userResult.rows[0].stream_id !== params.id) {
        return NextResponse.json({ error: 'Can only access your own stream' }, { status: 403 });
      }
    }

    // Get users who are in this stream and can be sheep seekers
    // (either already sheep_seekers or can be promoted)
    const result = await query(
      `SELECT 
        u.id,
        u.username,
        u.role,
        u.stream_id,
        u.group_id,
        g.name as current_group_name
       FROM users u
       LEFT JOIN groups g ON u.group_id = g.id
       WHERE u.stream_id = $1 
       AND u.role IN ('sheep_seeker', 'stream_leader')
       ORDER BY u.username`,
      [params.id]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching available leaders:', error);
    return NextResponse.json({ error: 'Failed to fetch available leaders' }, { status: 500 });
  }
}
