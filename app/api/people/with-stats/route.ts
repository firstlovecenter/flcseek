import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';
import { ATTENDANCE_GOAL, TOTAL_PROGRESS_STAGES } from '@/lib/constants';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Optimized endpoint that returns people with their progress and attendance stats
 * in a single query, avoiding N+1 query problem
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupIdParam = searchParams.get('group_id');
    const groupNameParam = searchParams.get('group');
    const monthParam = searchParams.get('month');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build the WHERE clause based on role and filters
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (userPayload.role === 'leader') {
      if (userPayload.group_id) {
        whereConditions.push(`rp.group_id = $${paramIndex++}`);
        params.push(userPayload.group_id);
      } else if (userPayload.group_name) {
        whereConditions.push(`rp.group_name = $${paramIndex++}`);
        params.push(userPayload.group_name);
      } else {
        return NextResponse.json({ people: [], total: 0 });
      }
    } else if (userPayload.role === 'admin') {
      if (userPayload.group_id) {
        whereConditions.push(`rp.group_id = $${paramIndex++}`);
        params.push(userPayload.group_id);
      } else {
        return NextResponse.json({ people: [], total: 0 });
      }
    } else {
      // Super admin and lead pastor can filter
      if (groupIdParam) {
        whereConditions.push(`rp.group_id = $${paramIndex++}`);
        params.push(groupIdParam);
      } else if (groupNameParam) {
        whereConditions.push(`rp.group_name = $${paramIndex++}`);
        params.push(groupNameParam);
      } else if (monthParam) {
        whereConditions.push(`rp.group_name = $${paramIndex++}`);
        params.push(monthParam);
      }
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Single optimized query that gets people with aggregated stats
    const sqlQuery = `
      SELECT 
        rp.id,
        rp.full_name,
        rp.phone_number,
        rp.gender,
        rp.home_location,
        rp.work_location,
        rp.group_id,
        rp.group_name,
        rp.created_at,
        g.name as group_name_ref,
        COUNT(DISTINCT CASE WHEN pr.is_completed = true THEN pr.id END) as completed_stages,
        COUNT(DISTINCT ar.id) as attendance_count
      FROM registered_people rp
      LEFT JOIN groups g ON rp.group_id = g.id
      LEFT JOIN progress_records pr ON rp.id = pr.person_id
      LEFT JOIN attendance_records ar ON rp.id = ar.person_id
      ${whereClause}
      GROUP BY rp.id, rp.full_name, rp.phone_number, rp.gender, rp.home_location, 
               rp.work_location, rp.group_id, rp.group_name, rp.created_at, g.name
      ORDER BY rp.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await query(sqlQuery, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM registered_people rp
      ${whereClause}
    `;
    const countParams = params.slice(0, params.length - 2); // Remove limit and offset
    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Calculate percentages
    const peopleWithStats = result.rows.map((person: any) => {
      const completedStages = parseInt(person.completed_stages || '0');
      const attendanceCount = parseInt(person.attendance_count || '0');
      
      return {
        ...person,
        completed_stages: completedStages,
        attendance_count: attendanceCount,
        progress_percentage: Math.round((completedStages / TOTAL_PROGRESS_STAGES) * 100),
        attendance_percentage: Math.min(Math.round((attendanceCount / ATTENDANCE_GOAL) * 100), 100),
      };
    });

    return NextResponse.json(
      { 
        people: peopleWithStats,
        total,
        limit,
        offset,
        has_more: offset + limit < total
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching people with stats:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
