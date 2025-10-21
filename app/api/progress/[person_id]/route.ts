import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // Only admins and superadmin can update milestones
    if (userPayload.role !== 'admin' && userPayload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized. Only admins and super admins can update milestones.' },
        { status: 403 }
      );
    }

    const { stage_number, is_completed } = await request.json();

    if (stage_number === undefined || is_completed === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Milestone 18 (Attendance) is auto-calculated from attendance records
    if (stage_number === 18) {
      return NextResponse.json(
        { error: 'Milestone 18 (Attendance) is automatically calculated from attendance records and cannot be manually updated' },
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

    // For admins, check if person is in their group
    if (userPayload.role === 'admin') {
      if (userPayload.group_id && person.group_id !== userPayload.group_id) {
        return NextResponse.json(
          { error: 'You can only update progress for people in your group' },
          { status: 403 }
        );
      }
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
