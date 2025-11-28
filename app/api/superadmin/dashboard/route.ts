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

    // Use CTE to combine all dashboard queries into one database round trip
    const dashboardResult = await query(`
      WITH 
      user_stats AS (
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as active
        FROM users
      ),
      group_stats AS (
        SELECT COUNT(*) as total FROM groups
      ),
      leader_stats AS (
        SELECT COUNT(*) as total 
        FROM users 
        WHERE role IN ('leader', 'admin', 'leadpastor')
      ),
      convert_stats AS (
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as this_month
        FROM new_converts
      ),
      recent_activity AS (
        SELECT 
          'USER' as type,
          'New user registered: ' || COALESCE(NULLIF(first_name || ' ' || last_name, ' '), username) as description,
          COALESCE(NULLIF(first_name || ' ' || last_name, ' '), username) as user,
          created_at as timestamp,
          id::text as id
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 10
      )
      SELECT 
        (SELECT row_to_json(user_stats.*) FROM user_stats) as user_stats,
        (SELECT row_to_json(group_stats.*) FROM group_stats) as group_stats,
        (SELECT row_to_json(leader_stats.*) FROM leader_stats) as leader_stats,
        (SELECT row_to_json(convert_stats.*) FROM convert_stats) as convert_stats,
        (SELECT json_agg(row_to_json(recent_activity.*)) FROM recent_activity) as recent_activity
    `);

    const data = dashboardResult.rows[0];
    const userStats = data.user_stats || {};
    const groupStats = data.group_stats || {};
    const leaderStats = data.leader_stats || {};
    const convertStats = data.convert_stats || {};

    const stats = {
      totalUsers: parseInt(userStats.total || '0'),
      activeUsers: parseInt(userStats.active || '0'),
      totalGroups: parseInt(groupStats.total || '0'),
      activeGroupLeaders: parseInt(leaderStats.total || '0'),
      totalConverts: parseInt(convertStats.total || '0'),
      convertsThisMonth: parseInt(convertStats.this_month || '0'),
    };

    return NextResponse.json(
      {
        stats,
        recentActivity: data.recent_activity || [],
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
