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
          { error: 'You can only update progress for people in your group' },
          { status: 403 }
        );
      }
    }

    // Check if group is archived
    if (person.group_id) {
      const archived = await isGroupArchived(person.group_id);
      if (archived) {
        return NextResponse.json(
          { error: 'Cannot update progress in an archived group' },
          { status: 403 }
        );
      }
    }

    const dateCompleted = is_completed ? new Date().toISOString().split('T')[0] : null;

    // Get the stage name from the milestones table
    const milestoneResult = await query(
      'SELECT name FROM milestones WHERE stage_number = $1',
      [stage_number]
    );
    
    const stageName = milestoneResult.rows[0]?.name || `Stage ${stage_number}`;

    // Use UPSERT to insert if not exists or update if exists
    const progressResult = await query(
      `INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, date_completed, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (person_id, stage_number)
       DO UPDATE SET 
         is_completed = $4,
         date_completed = $5,
         updated_by = $6
       RETURNING *`,
      [params.person_id, stage_number, stageName, is_completed, dateCompleted, userPayload.id]
    );

    const progress = progressResult.rows[0];

    return NextResponse.json({
      message: 'Progress updated successfully',
      progress,
    });
  } catch (error: any) {
    console.error('Error updating progress:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
