import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';
import { ATTENDANCE_GOAL } from '@/lib/constants';

// Helper function to check if a group is archived
async function isGroupArchived(groupId: string): Promise<boolean> {
  const result = await query(
    'SELECT archived FROM groups WHERE id = $1',
    [groupId]
  );
  return result.rows.length > 0 && result.rows[0].archived === true;
}

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

    // Only admins and superadmin can record/update attendance
    if (userPayload.role !== 'admin' && userPayload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized. Only admins and super admins can record attendance.' },
        { status: 403 }
      );
    }

    const { date_attended } = await request.json();

    if (!date_attended) {
      return NextResponse.json(
        { error: 'Date attended is required' },
        { status: 400 }
      );
    }

    // Validate that the date is a Sunday
    // Parse the date string as local time (YYYY-MM-DD format)
    const [year, month, day] = date_attended.split('-').map(Number);
    const attendedDate = new Date(year, month - 1, day);
    const dayOfWeek = attendedDate.getDay();
    
    if (dayOfWeek !== 0) { // 0 = Sunday
      return NextResponse.json(
        { error: 'Attendance can only be recorded for Sundays' },
        { status: 400 }
      );
    }

    // Validate that the attendance is not being entered more than 1 week past the Sunday
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    attendedDate.setHours(0, 0, 0, 0); // Ensure we're comparing dates only, not times
    
    const daysDifference = Math.floor((today.getTime() - attendedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDifference > 7) {
      return NextResponse.json(
        { error: 'Attendance cannot be recorded more than 1 week after the Sunday service date' },
        { status: 400 }
      );
    }

    // Don't allow future dates
    if (attendedDate > today) {
      return NextResponse.json(
        { error: 'Attendance cannot be recorded for future dates' },
        { status: 400 }
      );
    }

    const personResult = await query(
      'SELECT * FROM new_converts WHERE id = $1',
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
          {
            error: 'You can only record attendance for people in your group',
          },
          { status: 403 }
        );
      }
    }

    // Check if group is archived
    if (person.group_id) {
      const archived = await isGroupArchived(person.group_id);
      if (archived) {
        return NextResponse.json(
          { error: 'Cannot record attendance in an archived group' },
          { status: 403 }
        );
      }
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

    // Auto-update milestone 18 (Attendance) based on count
    const milestone18Completed = count >= ATTENDANCE_GOAL;
    const dateCompleted = milestone18Completed ? new Date().toISOString().split('T')[0] : null;
    
    await query(
      `UPDATE progress_records 
       SET is_completed = $1, date_completed = $2, last_updated = $3, updated_by = $4
       WHERE person_id = $5 AND stage_number = 18`,
      [milestone18Completed, dateCompleted, new Date().toISOString(), userPayload.id, params.person_id]
    );

    return NextResponse.json({
      message: 'Attendance recorded successfully',
      attendance,
      totalCount: count,
      milestone18Status: milestone18Completed ? 'completed' : 'pending',
    });
  } catch (error: any) {
    console.error('Error recording attendance:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { person_id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins and superadmin can delete attendance
    if (userPayload.role !== 'admin' && userPayload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized. Only admins and super admins can delete attendance.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const attendanceId = searchParams.get('id');

    if (!attendanceId) {
      return NextResponse.json(
        { error: 'Attendance ID is required' },
        { status: 400 }
      );
    }

    // Verify person exists and user has permission
    const personResult = await query(
      'SELECT * FROM new_converts WHERE id = $1',
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
          {
            error: 'You can only delete attendance for people in your group',
          },
          { status: 403 }
        );
      }
    }

    // Check if group is archived
    if (person.group_id) {
      const archived = await isGroupArchived(person.group_id);
      if (archived) {
        return NextResponse.json(
          { error: 'Cannot delete attendance in an archived group' },
          { status: 403 }
        );
      }
    }

    // Delete the attendance record
    await query(
      'DELETE FROM attendance_records WHERE id = $1 AND person_id = $2',
      [attendanceId, params.person_id]
    );

    // Recalculate count and update milestone 18
    const countResult = await query(
      'SELECT COUNT(*) as count FROM attendance_records WHERE person_id = $1',
      [params.person_id]
    );

    const count = parseInt(countResult.rows[0].count);
    const milestone18Completed = count >= ATTENDANCE_GOAL;
    const dateCompleted = milestone18Completed ? new Date().toISOString().split('T')[0] : null;

    await query(
      `UPDATE progress_records 
       SET is_completed = $1, date_completed = $2, last_updated = $3, updated_by = $4
       WHERE person_id = $5 AND stage_number = 18`,
      [milestone18Completed, dateCompleted, new Date().toISOString(), userPayload.id, params.person_id]
    );

    return NextResponse.json({
      message: 'Attendance deleted successfully',
      totalCount: count,
      milestone18Status: milestone18Completed ? 'completed' : 'pending',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
