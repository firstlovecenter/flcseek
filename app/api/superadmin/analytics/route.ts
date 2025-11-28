import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'superadmin') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Use CTE to combine all analytics queries into one database round trip
    const analyticsResult = await query(`
      WITH 
      user_stats AS (
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN role = 'superadmin' THEN 1 END) as super_admins,
          COUNT(CASE WHEN role = 'leader' THEN 1 END) as leaders,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
          COUNT(CASE WHEN role = 'leadpastor' THEN 1 END) as lead_pastors
        FROM users
      ),
      group_stats AS (
        SELECT 
          COUNT(DISTINCT g.id) as total,
          COALESCE(AVG(member_count), 0) as avg_members
        FROM (
          SELECT g.id, COUNT(rp.id) as member_count
          FROM groups g
          LEFT JOIN new_converts rp ON rp.group_id = g.id
          GROUP BY g.id
        ) as group_data
      ),
      group_leaders AS (
        SELECT COUNT(DISTINCT group_id) as with_leaders
        FROM users 
        WHERE group_id IS NOT NULL AND role IN ('leader', 'admin', 'leadpastor')
      ),
      convert_stats AS (
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as this_month,
          AVG(completion_rate) as avg_completion
        FROM (
          SELECT 
            rp.id,
            rp.created_at,
            (COUNT(CASE WHEN pr.is_completed THEN 1 END)::float / NULLIF((SELECT COUNT(*) FROM milestones WHERE is_active = true), 0) * 100) as completion_rate
          FROM new_converts rp
          LEFT JOIN progress_records pr ON pr.person_id = rp.id
          GROUP BY rp.id, rp.created_at
        ) as convert_data
      ),
      top_groups AS (
        SELECT 
          g.name,
          g.year,
          COUNT(rp.id) as members,
          COALESCE(AVG(
            (SELECT COUNT(*) FROM progress_records pr WHERE pr.person_id = rp.id AND pr.is_completed = true)::float / 
            NULLIF((SELECT COUNT(*) FROM milestones WHERE is_active = true), 0) * 100
          ), 0) as avg_progress
        FROM groups g
        LEFT JOIN new_converts rp ON rp.group_id = g.id
        GROUP BY g.id, g.name, g.year
        HAVING COUNT(rp.id) > 0
        ORDER BY members DESC, avg_progress DESC
        LIMIT 5
      ),
      top_seekers AS (
        SELECT 
          COALESCE(NULLIF(u.first_name || ' ' || u.last_name, ' '), u.username) as name,
          COUNT(rp.id) as converts
        FROM users u
        LEFT JOIN new_converts rp ON rp.registered_by = u.id
        WHERE u.role IN ('leader', 'admin', 'leadpastor')
        GROUP BY u.id, u.username, u.first_name, u.last_name
        HAVING COUNT(rp.id) > 0
        ORDER BY converts DESC
        LIMIT 5
      )
      SELECT 
        (SELECT row_to_json(user_stats.*) FROM user_stats) as user_stats,
        (SELECT row_to_json(group_stats.*) FROM group_stats) as group_stats,
        (SELECT row_to_json(group_leaders.*) FROM group_leaders) as group_leaders,
        (SELECT row_to_json(convert_stats.*) FROM convert_stats) as convert_stats,
        (SELECT json_agg(row_to_json(top_groups.*)) FROM top_groups) as top_groups,
        (SELECT json_agg(row_to_json(top_seekers.*)) FROM top_seekers) as top_seekers
    `);

    const data = analyticsResult.rows[0];
    const userStats = data.user_stats || {};
    const groupStats = data.group_stats || {};
    const groupLeaders = data.group_leaders || {};
    const convertStats = data.convert_stats || {};

    return NextResponse.json(
      {
        userStats: {
          total: parseInt(userStats.total || '0'),
          superAdmins: parseInt(userStats.super_admins || '0'),
          leaders: parseInt(userStats.leaders || '0'),
          admins: parseInt(userStats.admins || '0'),
          leadPastors: parseInt(userStats.lead_pastors || '0'),
          growthRate: 0,
        },
        groupStats: {
          total: parseInt(groupStats.total || '0'),
          withLeaders: parseInt(groupLeaders.with_leaders || '0'),
          avgMembersPerGroup: parseFloat(groupStats.avg_members || '0'),
        },
        convertStats: {
          total: parseInt(convertStats.total || '0'),
          thisMonth: parseInt(convertStats.this_month || '0'),
          avgProgressCompletion: parseFloat(convertStats.avg_completion || '0'),
        },
        topGroups: (data.top_groups || []).map((row: any) => ({
          name: row.name,
          year: row.year,
          members: parseInt(row.members),
          avgProgress: parseFloat(row.avg_progress || '0'),
        })),
        topSeekers: (data.top_seekers || []).map((row: any) => ({
          name: row.name,
          converts: parseInt(row.converts),
        })),
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
