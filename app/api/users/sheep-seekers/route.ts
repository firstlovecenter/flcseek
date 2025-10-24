import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';
import { ROOT_USER } from '@/lib/constants';

// GET /api/users/sheep-seekers - Get all sheep seeker users
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const result = await query(
      `SELECT 
        u.id,
        u.username,
        u.phone_number,
        u.created_at,
        d.id as department_id,
        d.name as department_name
       FROM users u
       LEFT JOIN groups d ON d.leader_id = u.id
       WHERE u.role = 'leader'
       ORDER BY u.username ASC`
    );

    // Filter out root user from results
    const filteredUsers = result.rows.filter(user => user.id !== ROOT_USER.ID);

    return NextResponse.json({ users: filteredUsers });
  } catch (error: any) {
    console.error('Get sheep seekers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
