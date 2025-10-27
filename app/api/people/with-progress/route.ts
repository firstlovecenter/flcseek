import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';
import { ATTENDANCE_GOAL } from '@/lib/constants';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Optimized endpoint that returns people with their complete progress records
 * in a single query, avoiding N+1 query problem
 * 
 * This replaces the pattern of:
 * 1. Fetch all people
 * 2. For each person, fetch their progress
 * 
 * With a single JOIN query that gets everything at once
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
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');

    // Build WHERE clause based on user role and filters
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    // Role-based filtering
    if (userPayload.role === 'leader') {
      if (userPayload.group_id) {
        whereConditions.push(`nc.group_id = $${paramIndex}`);
        params.push(userPayload.group_id);
        paramIndex++;
      } else if (userPayload.group_name) {
        whereConditions.push(`nc.group_name = $${paramIndex}`);
        params.push(userPayload.group_name);
        paramIndex++;
      }
    } else if (userPayload.role === 'admin') {
      if (userPayload.group_id) {
        whereConditions.push(`nc.group_id = $${paramIndex}`);
        params.push(userPayload.group_id);
        paramIndex++;
      }
    } else {
      // Super admin and lead pastor can filter by group/month
      if (groupIdParam) {
        whereConditions.push(`nc.group_id = $${paramIndex}`);
        params.push(groupIdParam);
        paramIndex++;
      } else if (monthParam) {
        whereConditions.push(`g.name = $${paramIndex}`);
        params.push(monthParam);
        paramIndex++;
        
        if (yearParam) {
          whereConditions.push(`g.year = $${paramIndex}`);
          params.push(parseInt(yearParam));
          paramIndex++;
        }
      }
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Single optimized query that gets people and their progress in one go
    const sqlQuery = `
      SELECT 
        nc.id,
        nc.first_name,
        nc.last_name,
        CONCAT(nc.first_name, ' ', nc.last_name) as full_name,
        nc.phone_number,
        nc.date_of_birth,
        nc.gender,
        nc.residential_location,
        nc.school_residential_location,
        nc.occupation_type,
        nc.group_id,
        nc.group_name,
        g.name as group_name_ref,
        g.year as group_year,
        nc.created_at,
        -- Aggregate progress records into JSON array
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'stage_number', pr.stage_number,
              'stage_name', pr.stage_name,
              'is_completed', pr.is_completed,
              'date_completed', pr.date_completed
            ) ORDER BY pr.stage_number
          ) FILTER (WHERE pr.stage_number IS NOT NULL),
          '[]'::json
        ) as progress,
        -- Count completed stages
        COUNT(CASE WHEN pr.is_completed = true THEN 1 END) as completed_stages,
        -- Get attendance count
        (SELECT COUNT(*) FROM attendance_records a WHERE a.person_id = nc.id) as attendance_count
      FROM new_converts nc
      LEFT JOIN groups g ON nc.group_id = g.id
      LEFT JOIN progress_records pr ON pr.person_id = nc.id
      ${whereClause}
      GROUP BY nc.id, g.name, g.year
      ORDER BY nc.first_name ASC, nc.last_name ASC
    `;

    const result = await query(sqlQuery, params);

    // Transform the data
    const people = result.rows.map((row: any) => ({
      ...row,
      progress: Array.isArray(row.progress) ? row.progress : [],
      completed_stages: parseInt(row.completed_stages || '0'),
      attendance_count: parseInt(row.attendance_count || '0'),
    }));

    return NextResponse.json(
      { 
        people,
        count: people.length 
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=5, stale-while-revalidate=10',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in /api/people/with-progress:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
