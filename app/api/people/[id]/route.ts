import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

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

    const { data: person, error: personError } = await supabase
      .from('registered_people')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (personError) throw personError;
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    if (
      userPayload.role === 'sheep_seeker' &&
      person.department_name !== userPayload.department_name
    ) {
      return NextResponse.json(
        { error: 'You can only view people in your department' },
        { status: 403 }
      );
    }

    const { data: progress, error: progressError } = await supabase
      .from('progress_records')
      .select('*')
      .eq('person_id', params.id)
      .order('stage_number', { ascending: true });

    if (progressError) throw progressError;

    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('person_id', params.id)
      .order('date_attended', { ascending: false });

    if (attendanceError) throw attendanceError;

    return NextResponse.json({
      person,
      progress,
      attendance,
      attendanceCount: attendance.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
