import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded: any = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get total users
    const usersResult = await query(
      `SELECT COUNT(*) as total, 
              COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as active
       FROM users`
    );

    // Get total groups
    const groupsResult = await query(`SELECT COUNT(*) as total FROM groups`);

    // Get active group leaders - count users with leader, admin, or leadpastor roles
    const leadersResult = await query(
      `SELECT COUNT(*) as total FROM users WHERE role IN ('leader', 'admin', 'leadpastor')`
    );

    // Get total converts (people registered)
    const convertsResult = await query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as this_month
       FROM new_converts`
    );

    // Get recent activity (last 10 actions)
    const activityResult = await query(
      `SELECT 
        'USER' as type,
        'New user registered: ' || username as description,
        username as user,
        created_at as timestamp,
        id::text as id
       FROM users 
       ORDER BY created_at DESC 
       LIMIT 10`
    );

    const stats = {
      totalUsers: parseInt(usersResult.rows[0]?.total || '0'),
      activeUsers: parseInt(usersResult.rows[0]?.active || '0'),
      totalGroups: parseInt(groupsResult.rows[0]?.total || '0'),
      activeGroupLeaders: parseInt(leadersResult.rows[0]?.total || '0'),
      totalConverts: parseInt(convertsResult.rows[0]?.total || '0'),
      convertsThisMonth: parseInt(convertsResult.rows[0]?.this_month || '0'),
    };

    return NextResponse.json({
      stats,
      recentActivity: activityResult.rows,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
