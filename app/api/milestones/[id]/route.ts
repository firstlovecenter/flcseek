import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyToken } from '@/lib/auth';

// Use NEON_DATABASE_URL (Netlify) or DATABASE_URL (local) with fallback for build time
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '';
const sql = connectionString ? neon(connectionString) : null;

// PUT /api/milestones/[id] - Update a milestone
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database connection not configured' },
        { status: 500 }
      );
    }

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;
    
    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized - Super Admin access required' },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { stage_number, stage_name, description } = body;

    // Validation
    if (!stage_number || !stage_name) {
      return NextResponse.json(
        { error: 'stage_number and stage_name are required' },
        { status: 400 }
      );
    }

    // Check if milestone exists
    const existing = await sql`
      SELECT id FROM progress_stages WHERE id = ${id}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Milestone not found' },
        { status: 404 }
      );
    }

    // Check if new stage number conflicts with another milestone
    const conflict = await sql`
      SELECT id FROM progress_stages 
      WHERE stage_number = ${stage_number} AND id != ${id}
    `;

    if (conflict.length > 0) {
      return NextResponse.json(
        { error: `Stage number ${stage_number} is already used by another milestone` },
        { status: 400 }
      );
    }

    // Update the milestone
    const result = await sql`
      UPDATE progress_stages
      SET 
        stage_number = ${stage_number},
        stage_name = ${stage_name},
        description = ${description || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({
      milestone: result[0],
      message: 'Milestone updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating milestone:', error);
    return NextResponse.json(
      { error: 'Failed to update milestone' },
      { status: 500 }
    );
  }
}

// DELETE /api/milestones/[id] - Delete a milestone
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database connection not configured' },
        { status: 500 }
      );
    }

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;
    
    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized - Super Admin access required' },
        { status: 403 }
      );
    }

    const { id } = params;

    // Check if milestone exists
    const existing = await sql`
      SELECT id, stage_number FROM progress_stages WHERE id = ${id}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Milestone not found' },
        { status: 404 }
      );
    }

    // Check if milestone is being used in progress tracking
    const inUse = await sql`
      SELECT COUNT(*) as count 
      FROM progress 
      WHERE stage_number = ${existing[0].stage_number}
    `;

    if (inUse[0].count > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete milestone - it is being used by ${inUse[0].count} progress record(s). Please remove associated progress data first.`,
        },
        { status: 400 }
      );
    }

    // Delete the milestone
    await sql`
      DELETE FROM progress_stages WHERE id = ${id}
    `;

    return NextResponse.json({
      message: 'Milestone deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting milestone:', error);
    return NextResponse.json(
      { error: 'Failed to delete milestone' },
      { status: 500 }
    );
  }
}
