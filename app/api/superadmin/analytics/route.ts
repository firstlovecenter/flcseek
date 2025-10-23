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
    // User stats
    const userStatsResult = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN role = 'superadmin' THEN 1 END) as super_admins,
        COUNT(CASE WHEN role = 'leader' THEN 1 END) as leaders,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN role = 'leadpastor' THEN 1 END) as lead_pastors
       FROM users`
    );

    // Group stats
    const groupStatsResult = await query(
      `SELECT 
        COUNT(DISTINCT g.id) as total,
        COALESCE(AVG(member_count), 0) as avg_members
       FROM (
         SELECT g.id, COUNT(rp.id) as member_count
         FROM groups g
         LEFT JOIN registered_people rp ON rp.group_name = g.name
         GROUP BY g.id
       ) as group_data`
    );
    
    // Count groups with leaders (users assigned to groups)
    const groupLeadersResult = await query(
      `SELECT COUNT(DISTINCT group_name) as with_leaders
       FROM users 
       WHERE group_name IS NOT NULL AND role IN ('leader', 'admin', 'leadpastor')`
    );

    // Convert stats
    const convertStatsResult = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as this_month,
        AVG(completion_rate) as avg_completion
       FROM (
         SELECT 
           rp.id,
           rp.created_at,
           (COUNT(CASE WHEN pr.is_completed THEN 1 END)::float / 15 * 100) as completion_rate
         FROM registered_people rp
         LEFT JOIN progress_records pr ON pr.person_id = rp.id
         GROUP BY rp.id, rp.created_at
       ) as convert_data`
    );

    // Top groups
    const topGroupsResult = await query(
      `SELECT 
        g.name,
        COUNT(rp.id) as members,
        COALESCE(AVG(
          (SELECT COUNT(*) FROM progress_records pr WHERE pr.person_id = rp.id AND pr.is_completed = true)::float / 15 * 100
        ), 0) as avg_progress
       FROM groups g
       LEFT JOIN registered_people rp ON rp.group_name = g.name
       GROUP BY g.name
       HAVING COUNT(rp.id) > 0
       ORDER BY members DESC, avg_progress DESC
       LIMIT 5`
    );

    // Top seekers
    const topSeekersResult = await query(
      `SELECT 
        u.username as name,
        COUNT(rp.id) as converts
       FROM users u
       LEFT JOIN registered_people rp ON rp.registered_by = u.id
       WHERE u.role IN ('leader', 'admin', 'leadpastor')
       GROUP BY u.id, u.username
       HAVING COUNT(rp.id) > 0
       ORDER BY converts DESC
       LIMIT 5`
    );

    const userStats = userStatsResult.rows[0];
    const groupStats = groupStatsResult.rows[0];
    const groupLeaders = groupLeadersResult.rows[0];
    const convertStats = convertStatsResult.rows[0];

    return NextResponse.json({
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
      topGroups: topGroupsResult.rows.map((row) => ({
        name: row.name,
        members: parseInt(row.members),
        avgProgress: parseFloat(row.avg_progress || '0'),
      })),
      topSeekers: topSeekersResult.rows.map((row) => ({
        name: row.name,
        converts: parseInt(row.converts),
      })),
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
