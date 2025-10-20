import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';
import { ATTENDANCE_GOAL } from '@/lib/constants';

export async function POST(
  request: NextRequest,
  { params }: { params: { person_id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date_attended } = await request.json();

    if (!date_attended) {
      return NextResponse.json(
        { error: 'Date attended is required' },
        { status: 400 }
      );
    }

    const personResult = await query(
      'SELECT * FROM registered_people WHERE id = $1',
      [params.person_id]
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
        {
          error: 'You can only record attendance for people in your group',
        },
        { status: 403 }
      );
    }

    const existingResult = await query(
      'SELECT id FROM attendance_records WHERE person_id = $1 AND date_attended = $2',
      [params.person_id, date_attended]
    );

    if (existingResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'Attendance already recorded for this date' },
        { status: 409 }
      );
    }

    const attendanceResult = await query(
      `INSERT INTO attendance_records (person_id, date_attended, recorded_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [params.person_id, date_attended, userPayload.id]
    );

    const attendance = attendanceResult.rows[0];

    const countResult = await query(
      'SELECT COUNT(*) as count FROM attendance_records WHERE person_id = $1',
      [params.person_id]
    );

    const count = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      message: 'Attendance recorded successfully',
      attendance,
      totalCount: count,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { person_id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const attendanceResult = await query(
      'SELECT * FROM attendance_records WHERE person_id = $1 ORDER BY date_attended DESC',
      [params.person_id]
    );

    return NextResponse.json({
      attendance: attendanceResult.rows,
      count: attendanceResult.rows.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
