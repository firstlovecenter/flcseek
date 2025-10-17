import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { DEPARTMENTS, ATTENDANCE_GOAL } from '@/lib/constants';

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

    const summary = await Promise.all(
      DEPARTMENTS.map(async (dept) => {
        const { data: people, error: peopleError } = await supabase
          .from('registered_people')
          .select('id')
          .eq('department_name', dept);

        if (peopleError) throw peopleError;

        const totalPeople = people.length;

        if (totalPeople === 0) {
          return {
            department: dept,
            totalPeople: 0,
            avgProgress: 0,
            avgAttendance: 0,
          };
        }

        let totalProgressPercentage = 0;
        let totalAttendancePercentage = 0;

        for (const person of people) {
          const { data: progress } = await supabase
            .from('progress_records')
            .select('is_completed')
            .eq('person_id', person.id);

          const completedStages =
            progress?.filter((p) => p.is_completed).length || 0;
          const progressPercentage = (completedStages / 15) * 100;
          totalProgressPercentage += progressPercentage;

          const { count: attendanceCount } = await supabase
            .from('attendance_records')
            .select('*', { count: 'exact', head: true })
            .eq('person_id', person.id);

          const attendancePercentage =
            ((attendanceCount || 0) / ATTENDANCE_GOAL) * 100;
          totalAttendancePercentage += Math.min(attendancePercentage, 100);
        }

        return {
          department: dept,
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
