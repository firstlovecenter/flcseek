import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';
import { PROGRESS_STAGES } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized - Superadmin only' }, { status: 401 });
    }

    // Get all registered people
    const peopleResult = await query('SELECT id FROM registered_people');
    const people = peopleResult.rows;

    let initialized = 0;
    let skipped = 0;

    for (const person of people) {
      // Check if this person already has progress records
      const existingProgress = await query(
        'SELECT COUNT(*) as count FROM progress_records WHERE person_id = $1',
        [person.id]
      );

      const existingCount = parseInt(existingProgress.rows[0].count);

      if (existingCount === 0) {
        // Initialize all 18 progress stages for this person
        for (const stage of PROGRESS_STAGES) {
          await query(
            `INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, updated_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (person_id, stage_number) DO NOTHING`,
            [person.id, stage.number, stage.name, false, userPayload.id]
          );
        }
        initialized++;
      } else if (existingCount < PROGRESS_STAGES.length) {
        // Person has some progress records but not all - fill in missing ones
        for (const stage of PROGRESS_STAGES) {
          await query(
            `INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, updated_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (person_id, stage_number) DO NOTHING`,
            [person.id, stage.number, stage.name, false, userPayload.id]
          );
        }
        initialized++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      message: 'Progress initialization complete',
      totalPeople: people.length,
      initialized,
      skipped,
    });
  } catch (error: any) {
    console.error('Error initializing progress:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
