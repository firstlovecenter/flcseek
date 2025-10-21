import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';
import { ATTENDANCE_GOAL, TOTAL_PROGRESS_STAGES } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized. Super Admin access required.' },
        { status: 403 }
      );
    }

    // Fetch actual groups from database
    const groupsResult = await query(`
      SELECT 
        g.id,
        g.name
      FROM groups g
      WHERE g.is_active = true
      ORDER BY g.name
    `);
    const groups = groupsResult.rows;

    const summary = await Promise.all(
      groups.map(async (group) => {
        const peopleResult = await query(
          'SELECT id FROM registered_people WHERE group_id = $1',
          [group.id]
        );

        const people = peopleResult.rows;
        const totalPeople = people.length;

        if (totalPeople === 0) {
          return {
            group: group.name,
            totalPeople: 0,
            avgProgress: 0,
            avgAttendance: 0,
          };
        }

        let totalProgressPercentage = 0;
        let totalAttendancePercentage = 0;

        for (const person of people) {
          const progressResult = await query(
            'SELECT is_completed FROM progress_records WHERE person_id = $1',
            [person.id]
          );

          const completedStages =
            progressResult.rows.filter((p: any) => p.is_completed).length;
          const progressPercentage = (completedStages / TOTAL_PROGRESS_STAGES) * 100;
          totalProgressPercentage += progressPercentage;

          const attendanceResult = await query(
            'SELECT COUNT(*) as count FROM attendance_records WHERE person_id = $1',
            [person.id]
          );

          const attendanceCount = parseInt(attendanceResult.rows[0].count);
          const attendancePercentage = (attendanceCount / ATTENDANCE_GOAL) * 100;
          totalAttendancePercentage += Math.min(attendancePercentage, 100);
        }

        return {
          group: group.name,
          totalPeople,
          avgProgress: Math.round(totalProgressPercentage / totalPeople),
          avgAttendance: Math.round(totalAttendancePercentage / totalPeople),
        };
      })
    );

    return NextResponse.json({ summary });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
