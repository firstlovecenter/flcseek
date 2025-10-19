import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { person_id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { stage_number, is_completed } = await request.json();

    if (stage_number === undefined || is_completed === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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
      userPayload.role === 'sheep_seeker' &&
      person.group_name !== userPayload.group_name
    ) {
      return NextResponse.json(
        { error: 'You can only update progress for people in your group' },
        { status: 403 }
      );
    }

    const dateCompleted = is_completed ? new Date().toISOString().split('T')[0] : null;
    const lastUpdated = new Date().toISOString();

    const progressResult = await query(
      `UPDATE progress_records 
       SET is_completed = $1, updated_by = $2, last_updated = $3, date_completed = $4
       WHERE person_id = $5 AND stage_number = $6
       RETURNING *`,
      [is_completed, userPayload.id, lastUpdated, dateCompleted, params.person_id, stage_number]
    );

    const progress = progressResult.rows[0];

    return NextResponse.json({
      message: 'Progress updated successfully',
      progress,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
