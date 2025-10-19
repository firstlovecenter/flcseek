import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';
import { PROGRESS_STAGES } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { full_name, phone_number, gender, home_location, work_location, group_name } =
      await request.json();

    if (!full_name || !phone_number || !group_name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (
      userPayload.role === 'sheep_seeker' &&
      group_name !== userPayload.group_name
    ) {
      return NextResponse.json(
        { error: 'You can only register people in your group' },
        { status: 403 }
      );
    }

    const result = await query(
      `INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, group_name, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [full_name, phone_number, gender, home_location, work_location, group_name, userPayload.id]
    );

    const person = result.rows[0];

    const progressRecords = PROGRESS_STAGES.map((stage) => ({
      person_id: person.id,
      stage_number: stage.number,
      stage_name: stage.name,
      is_completed: false,
      updated_by: userPayload.id,
    }));

    // Insert progress records
    for (const record of progressRecords) {
      await query(
        `INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, updated_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [record.person_id, record.stage_number, record.stage_name, record.is_completed, record.updated_by]
      );
    }

    return NextResponse.json({
      message: 'Person registered successfully',
      person,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const group = searchParams.get('group');

    let sqlQuery = 'SELECT * FROM registered_people';
    let params: any[] = [];

    if (userPayload.role === 'sheep_seeker') {
      sqlQuery += ' WHERE group_name = $1';
      params.push(userPayload.group_name);
    } else if (group) {
      sqlQuery += ' WHERE group_name = $1';
      params.push(group);
    }

    sqlQuery += ' ORDER BY created_at DESC';

    const result = await query(sqlQuery, params);

    return NextResponse.json({ people: result.rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
