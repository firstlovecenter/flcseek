import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWeeklyReminder } from '@/lib/mnotify';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Super Admin access required.' },
        { status: 403 }
      );
    }

    const { data: people, error } = await supabase
      .from('registered_people')
      .select('full_name, phone_number');

    if (error) throw error;

    const results = await Promise.allSettled(
      people.map((person) =>
        sendWeeklyReminder(person.full_name, person.phone_number)
      )
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({
      message: 'Weekly reminders sent',
      total: people.length,
      successful,
      failed,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
