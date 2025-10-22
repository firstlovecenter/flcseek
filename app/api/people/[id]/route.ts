import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const personResult = await query(
      'SELECT * FROM registered_people WHERE id = $1',
      [params.id]
    );

    const person = personResult.rows[0];

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    if (
      userPayload.role === 'leader' &&
      person.group_name !== userPayload.group_name
    ) {
      return NextResponse.json(
        { error: 'You can only view people in your group' },
        { status: 403 }
      );
    }

    const progressResult = await query(
      'SELECT * FROM progress_records WHERE person_id = $1 ORDER BY stage_number ASC',
      [params.id]
    );

    const attendanceResult = await query(
      'SELECT * FROM attendance_records WHERE person_id = $1 ORDER BY date_attended DESC',
      [params.id]
    );

    return NextResponse.json(
      {
        person,
        progress: progressResult.rows,
        attendance: attendanceResult.rows,
        attendanceCount: attendanceResult.rows.length,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { full_name, phone_number, gender, home_location, work_location, group_name } =
      await request.json();

    // Verify person exists and user has permission
    const personResult = await query(
      'SELECT * FROM registered_people WHERE id = $1',
      [params.id]
    );

    const person = personResult.rows[0];

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    if (
      userPayload.role === 'leader' &&
      person.group_name !== userPayload.group_name
    ) {
      return NextResponse.json(
        { error: 'You can only update people in your group' },
        { status: 403 }
      );
    }

    // Update person
    const result = await query(
      `UPDATE registered_people 
       SET full_name = $1, phone_number = $2, gender = $3, home_location = $4, work_location = $5, group_name = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [full_name, phone_number, gender, home_location, work_location, group_name, params.id]
    );

    return NextResponse.json({
      message: 'Person updated successfully',
      person: result.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
