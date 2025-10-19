import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';
import { ATTENDANCE_GOAL } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Super Admin access required.' },
        { status: 403 }
      );
    }

    // Fetch actual groups from database
    const groupsResult = await query('SELECT name FROM groups ORDER BY name');
    const groups = groupsResult.rows.map((row: any) => row.name);

    const summary = await Promise.all(
      groups.map(async (group) => {
        const peopleResult = await query(
          'SELECT id FROM registered_people WHERE group_name = $1',
          [group]
        );

        const people = peopleResult.rows;
        const totalPeople = people.length;

        if (totalPeople === 0) {
          return {
            group: group,
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
          const progressPercentage = (completedStages / 15) * 100;
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
          group: group,
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
