/**
 * EXAMPLE: Milestones Endpoint - BEFORE & AFTER Migration
 * 
 * This file shows the EXACT same endpoint:
 * - LEFT: Current implementation with Neon SQL
 * - RIGHT: Migrated implementation with Prisma ORM
 * 
 * Use this as a template for migrating other endpoints!
 */

// ============================================================================
// BEFORE (Current - Using Neon)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';

// GET - List all milestones
export async function GET_OLD(request: NextRequest) {
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
export async function POST_OLD(request: NextRequest) {
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
export async function PUT_OLD(request: NextRequest) {
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
export async function DELETE_OLD(request: NextRequest) {
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

// ============================================================================
// AFTER (Migrated - Using Prisma)
// ============================================================================

import { prisma } from '@/lib/prisma';

// GET - List all milestones
export async function GET_NEW(request: NextRequest) {
  try {
    const milestones = await prisma.milestone.findMany({
      orderBy: {
        stageNumber: 'asc'
      }
    });

    return NextResponse.json({ milestones });
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new milestone
export async function POST_NEW(request: NextRequest) {
  try {
    const body = await request.json();
    const { stage_number, stage_name, short_name, description } = body;

    if (!stage_number || !stage_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if stage_number already exists
    const existingStage = await prisma.milestone.findUnique({
      where: { stageNumber: stage_number }
    });

    if (existingStage) {
      return NextResponse.json({ error: 'Stage number already exists' }, { status: 400 });
    }

    const milestone = await prisma.milestone.create({
      data: {
        stageNumber: stage_number,
        stageName: stage_name,
        shortName: short_name,
        description: description,
      }
    });

    return NextResponse.json({ milestone }, { status: 201 });
  } catch (error) {
    console.error('Error creating milestone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a milestone
export async function PUT_NEW(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, stage_name, short_name, description } = body;

    if (!id || !stage_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const milestone = await prisma.milestone.update({
      where: { id },
      data: {
        stageName: stage_name,
        shortName: short_name,
        description: description,
        // updatedAt is automatically managed by Prisma @updatedAt decorator
      }
    });

    return NextResponse.json({ milestone });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }
    console.error('Error updating milestone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a milestone
export async function DELETE_NEW(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing milestone ID' }, { status: 400 });
    }

    // Check if milestone is being used in progress_records
    const milestone = await prisma.milestone.findUnique({
      where: { id },
    });

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    // Check if there are any progress records using this milestone's stage number
    const progressCount = await prisma.progressRecord.count({
      where: { stageNumber: milestone.stageNumber }
    });

    if (progressCount > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete milestone that is being used in progress records' 
      }, { status: 400 });
    }

    await prisma.milestone.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Milestone deleted successfully' });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }
    console.error('Error deleting milestone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// KEY DIFFERENCES & BENEFITS
// ============================================================================

/*
1. CLEANER CODE
   - Old: SQL strings with parameterized queries
   - New: Clean, typed objects

2. TYPE SAFETY
   - Old: No autocomplete, prone to typos
   - New: Full IntelliSense, catches errors at compile time

3. FIELD MAPPING
   - Old: Must remember snake_case (stage_number)
   - New: Use camelCase (stageNumber), Prisma handles mapping

4. RESULT HANDLING
   - Old: result.rows[0], manually check length
   - New: Direct object, Prisma throws P2025 error if not found

5. RELATIONS
   - Old: Complex JOIN queries
   - New: Simple `include: { progressRecords: true }`

6. ERROR HANDLING
   - Old: Generic error handling
   - New: Specific Prisma error codes (P2025 = not found, etc.)

7. UNIQUE CONSTRAINTS
   - Old: Query first, then insert
   - New: Prisma handles unique constraints automatically

8. DATE HANDLING
   - Old: Manually set NOW()
   - New: @updatedAt decorator handles it

9. COUNTING
   - Old: COUNT(*) queries
   - New: check array length or use .count()

10. TRANSACTIONS
    - Old: BEGIN/COMMIT/ROLLBACK
    - New: prisma.$transaction(async (tx) => { ... })
*/

// ============================================================================
// MIGRATION CHECKLIST FOR THIS ENDPOINT
// ============================================================================

/*
[ ] 1. Replace import statement
       FROM: import { query } from '@/lib/neon'
       TO:   import { prisma } from '@/lib/prisma'

[ ] 2. Update GET handler
       - Replace query() with prisma.milestone.findMany()
       - Add orderBy clause
       - Remove result.rows reference

[ ] 3. Update POST handler
       - Replace SELECT query with prisma.milestone.findUnique()
       - Replace INSERT query with prisma.milestone.create()
       - Update field names to camelCase

[ ] 4. Update PUT handler
       - Replace UPDATE query with prisma.milestone.update()
       - Add P2025 error handling
       - Update field names

[ ] 5. Update DELETE handler
       - Replace JOIN query with include
       - Replace DELETE query with prisma.milestone.delete()
       - Add P2025 error handling

[ ] 6. Test each endpoint
       - GET: Verify milestones list
       - POST: Try creating new milestone
       - PUT: Try updating existing milestone
       - DELETE: Try deleting unused milestone

[ ] 7. Verify data integrity
       - Compare response structure
       - Verify all fields are present
       - Check date formats

[ ] 8. Remove old code
       - Remove Neon import if no longer needed
       - Clean up comments
       - Update any related tests
*/

export {}
