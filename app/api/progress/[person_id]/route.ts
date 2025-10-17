import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { sendStageCompletionSMS } from '@/lib/mnotify';

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

    const { stage_number, is_completed } = await request.json();

    if (stage_number === undefined || is_completed === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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
        { error: 'You can only update progress for people in your department' },
        { status: 403 }
      );
    }

    const updateData: any = {
      is_completed,
      updated_by: userPayload.id,
      last_updated: new Date().toISOString(),
    };

    if (is_completed) {
      updateData.date_completed = new Date().toISOString().split('T')[0];
    } else {
      updateData.date_completed = null;
    }

    const { data: progress, error: updateError } = await supabase
      .from('progress_records')
      .update(updateData)
      .eq('person_id', params.person_id)
      .eq('stage_number', stage_number)
      .select()
      .single();

    if (updateError) throw updateError;

    if (is_completed) {
      await sendStageCompletionSMS(
        person.full_name,
        person.phone_number,
        progress.stage_name
      );
    }

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
