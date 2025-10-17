import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { sendCompletionSMS } from '@/lib/mnotify';
import { ATTENDANCE_GOAL } from '@/lib/constants';

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

    const { date_attended } = await request.json();

    if (!date_attended) {
      return NextResponse.json(
        { error: 'Date attended is required' },
        { status: 400 }
      );
    }

    const { data: person, error: personError } = await supabase
      .from('registered_people')
      .select('*')
      .eq('id', params.person_id)
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
        {
          error: 'You can only record attendance for people in your department',
        },
        { status: 403 }
      );
    }

    const { data: existingAttendance } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('person_id', params.person_id)
      .eq('date_attended', date_attended)
      .maybeSingle();

    if (existingAttendance) {
      return NextResponse.json(
        { error: 'Attendance already recorded for this date' },
        { status: 409 }
      );
    }

    const { data: attendance, error: insertError } = await supabase
      .from('attendance_records')
      .insert({
        person_id: params.person_id,
        date_attended,
        recorded_by: userPayload.id,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const { count } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', params.person_id);

    if (count === ATTENDANCE_GOAL) {
      await sendCompletionSMS(person.full_name, person.phone_number);
    }

    return NextResponse.json({
      message: 'Attendance recorded successfully',
      attendance,
      totalCount: count,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
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

    const { data: attendance, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('person_id', params.person_id)
      .order('date_attended', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      attendance,
      count: attendance.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
