import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized - Superadmin only' }, { status: 401 });
    }

    // Get all milestones from the database
    const milestonesResult = await query('SELECT stage_number, name FROM milestones ORDER BY stage_number');
    const milestones = milestonesResult.rows;

    if (milestones.length === 0) {
      return NextResponse.json({ error: 'No milestones found in database' }, { status: 400 });
    }

    // Get all registered people
    const peopleResult = await query('SELECT id FROM new_converts');
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
        // Initialize all milestones for this person
        for (const milestone of milestones) {
          await query(
            `INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, updated_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (person_id, stage_number) DO NOTHING`,
            [person.id, milestone.stage_number, milestone.name, false, userPayload.id]
          );
        }
        initialized++;
      } else if (existingCount < milestones.length) {
        // Person has some progress records but not all - fill in missing ones
        for (const milestone of milestones) {
          await query(
            `INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, updated_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (person_id, stage_number) DO NOTHING`,
            [person.id, milestone.stage_number, milestone.name, false, userPayload.id]
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
