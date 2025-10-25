import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';
import { ATTENDANCE_GOAL } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized. Super Admin access required.' },
        { status: 403 }
      );
    }

    // Get total milestones count from database
    const milestonesResult = await query('SELECT COUNT(*) as count FROM milestones');
    const totalMilestones = parseInt(milestonesResult.rows[0]?.count || '18');

    // Optimized single query that calculates all stats using aggregation
    const summaryResult = await query(`
      SELECT 
        g.name as group,
        COUNT(DISTINCT rp.id) as total_people,
        COALESCE(
          ROUND(AVG(
            (SELECT COUNT(*) * 100.0 / $1
             FROM progress_records pr 
             WHERE pr.person_id = rp.id AND pr.is_completed = true)
          )), 0
        ) as avg_progress,
        COALESCE(
          ROUND(AVG(
            LEAST(
              (SELECT COUNT(*) * 100.0 / $2
               FROM attendance_records ar 
               WHERE ar.person_id = rp.id),
              100
            )
          )), 0
        ) as avg_attendance
      FROM groups g
      LEFT JOIN new_converts rp ON g.id = rp.group_id
      WHERE g.is_active = true
      GROUP BY g.id, g.name
      ORDER BY g.name
    `, [totalMilestones, ATTENDANCE_GOAL]);

    const summary = summaryResult.rows.map((row: any) => ({
      group: row.group,
      totalPeople: parseInt(row.total_people),
      avgProgress: parseInt(row.avg_progress),
      avgAttendance: parseInt(row.avg_attendance),
    }));

    return NextResponse.json(
      { summary },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching department summary:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
