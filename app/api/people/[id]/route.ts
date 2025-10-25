import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper function to check if a group is archived
async function isGroupArchived(groupId: string): Promise<boolean> {
  const result = await query(
    'SELECT archived FROM groups WHERE id = $1',
    [groupId]
  );
  return result.rows.length > 0 && result.rows[0].archived === true;
}

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
      'SELECT * FROM new_converts WHERE id = $1',
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
      'SELECT * FROM new_converts WHERE id = $1',
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

    // Check if group is archived
    if (person.group_id) {
      const archived = await isGroupArchived(person.group_id);
      if (archived) {
        return NextResponse.json(
          { error: 'Cannot update people in an archived group' },
          { status: 403 }
        );
      }
    }

    // Update the person
    const result = await query(
      `UPDATE new_converts 
       SET first_name = $1, last_name = $2, full_name = $3, phone_number = $4,
           date_of_birth = $5, gender = $6, residential_location = $7, 
           school_residential_location = $8, occupation_type = $9, 
           home_location = $10, work_location = $11, group_id = $12, group_name = $13
       WHERE id = $14
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
