import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'superadmin') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// GET - List all milestones
export async function GET(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT id, stage_number, stage_name, short_name, description, is_active, created_at, updated_at
       FROM milestones
       ORDER BY stage_number ASC`
    );

    return NextResponse.json({ milestones: result.rows });
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new milestone
export async function POST(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { stage_number, stage_name, short_name, description } = body;

    if (!stage_number || !stage_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if stage_number already exists
    const existingStage = await query(
      `SELECT id FROM milestones WHERE stage_number = $1`,
      [stage_number]
    );

    if (existingStage.rows.length > 0) {
      return NextResponse.json({ error: 'Stage number already exists' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO milestones (stage_number, stage_name, short_name, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [stage_number, stage_name, short_name, description]
    );

    return NextResponse.json({ milestone: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating milestone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a milestone
export async function PUT(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, stage_name, short_name, description } = body;

    if (!id || !stage_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await query(
      `UPDATE milestones 
       SET stage_name = $1, short_name = $2, description = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [stage_name, short_name, description, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    return NextResponse.json({ milestone: result.rows[0] });
  } catch (error) {
    console.error('Error updating milestone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a milestone
export async function DELETE(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing milestone ID' }, { status: 400 });
    }

    // Check if milestone is being used in progress_records
    const usageCheck = await query(
      `SELECT COUNT(*) as count FROM progress_records pr
       JOIN milestones m ON pr.stage_number = m.stage_number
       WHERE m.id = $1`,
      [id]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete milestone that is being used in progress records' 
      }, { status: 400 });
    }

    const result = await query(
      `DELETE FROM milestones WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Milestone deleted successfully' });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Toggle milestone active status
export async function PATCH(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, is_active } = body;

    if (!id || typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await query(
      `UPDATE milestones 
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [is_active, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    const milestone = result.rows[0];

    // If reactivating a milestone, backfill missing progress records for all converts
    if (is_active === true) {
      console.log(`Reactivating milestone ${milestone.stage_number}, checking for missing progress records...`);
      
      // Find all converts who don't have a progress record for this milestone
      const missingRecords = await query(
        `SELECT nc.id as person_id
         FROM new_converts nc
         WHERE NOT EXISTS (
           SELECT 1 FROM progress_records pr
           WHERE pr.person_id = nc.id
           AND pr.stage_number = $1
         )`,
        [milestone.stage_number]
      );

      if (missingRecords.rows.length > 0) {
        console.log(`Found ${missingRecords.rows.length} converts missing this milestone, backfilling...`);
        
        // Backfill progress records for all missing converts
        // Use bulk insert for efficiency
        const values = missingRecords.rows.map((row, index) => {
          const offset = index * 5;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
        }).join(', ');

        const params = missingRecords.rows.flatMap(row => [
          row.person_id,
          milestone.stage_number,
          milestone.stage_name,
          false, // is_completed = false
          user.username || 'system' // updated_by
        ]);

        await query(
          `INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, updated_by)
           VALUES ${values}`,
          params
        );

        return NextResponse.json({ 
          milestone: milestone,
          backfilled: missingRecords.rows.length,
          message: `Milestone activated and ${missingRecords.rows.length} progress record(s) backfilled`
        });
      }
    }

    return NextResponse.json({ milestone: result.rows[0] });
  } catch (error) {
    console.error('Error toggling milestone status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
