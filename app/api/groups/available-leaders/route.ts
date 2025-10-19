import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// GET /api/groups/available-leaders - Get users who can be assigned as group leaders
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all users who are not super_admins
    // Include users with no role (they'll be assigned sheep_seeker when assigned to a group)
    const result = await query(`
      SELECT 
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        g.name as current_group,
        g.id as current_group_id
      FROM users u
      LEFT JOIN groups g ON g.leader_id = u.id
      WHERE u.role IS NULL OR u.role = 'sheep_seeker'
      ORDER BY u.first_name, u.last_name, u.username
    `);

    return NextResponse.json({ users: result.rows });
  } catch (error: any) {
    console.error('Error fetching available leaders:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
