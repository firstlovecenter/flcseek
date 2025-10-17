import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { sendWelcomeSMS } from '@/lib/mnotify';
import { PROGRESS_STAGES } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { full_name, phone_number, gender, department_name } =
      await request.json();

    if (!full_name || !phone_number || !department_name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (
      userPayload.role === 'sheep_seeker' &&
      department_name !== userPayload.department_name
    ) {
      return NextResponse.json(
        { error: 'You can only register people in your department' },
        { status: 403 }
      );
    }

    const { data: person, error } = await supabase
      .from('registered_people')
      .insert({
        full_name,
        phone_number,
        gender,
        department_name,
        registered_by: userPayload.id,
      })
      .select()
      .single();

    if (error) throw error;

    const progressRecords = PROGRESS_STAGES.map((stage) => ({
      person_id: person.id,
      stage_number: stage.number,
      stage_name: stage.name,
      is_completed: false,
      updated_by: userPayload.id,
    }));

    await supabase.from('progress_records').insert(progressRecords);

    await sendWelcomeSMS(full_name, phone_number);

    return NextResponse.json({
      message: 'Person registered successfully',
      person,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    let query = supabase.from('registered_people').select('*');

    if (userPayload.role === 'sheep_seeker') {
      query = query.eq('department_name', userPayload.department_name!);
    } else if (department) {
      query = query.eq('department_name', department);
    }

    const { data: people, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) throw error;

    return NextResponse.json({ people });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
