import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// GET /api/departments/[id] - Get single department
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

    const result = await query(
      `SELECT 
        d.id,
        d.name,
        d.description,
        d.leader_id,
        d.created_at,
        d.updated_at,
        u.username as leader_username,
        u.phone_number as leader_phone
       FROM groups d
       LEFT JOIN users u ON d.leader_id = u.id
       WHERE d.id = $1`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ department: result.rows[0] });
  } catch (error: any) {
    console.error('Get department error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/departments/[id] - Update department
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized. Only super admins can update departments.' },
        { status: 403 }
      );
    }

    const { name, description, leader_id } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      );
    }

    // Verify group exists
    const deptCheck = await query('SELECT id FROM groups WHERE id = $1', [
      params.id,
    ]);

    if (deptCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // Verify leader exists and is a sheep_seeker if provided
    if (leader_id) {
      const leaderCheck = await query(
        'SELECT id, role FROM users WHERE id = $1',
        [leader_id]
      );

      if (leaderCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Selected user does not exist' },
          { status: 400 }
        );
      }

      if (leaderCheck.rows[0].role !== 'sheep_seeker') {
        return NextResponse.json(
          { error: 'Department leader must be a Sheep Seeker' },
          { status: 400 }
        );
      }
    }

    // Update group
    const result = await query(
      `UPDATE groups 
       SET name = $1, description = $2, leader_id = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [name.trim(), description?.trim() || null, leader_id || null, params.id]
    );

    return NextResponse.json({
      message: 'Department updated successfully',
      department: result.rows[0],
    });
  } catch (error: any) {
    console.error('Update department error:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Department name already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/[id] - Delete department
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized. Only super admins can delete departments.' },
        { status: 403 }
      );
    }

    // Check if group exists
    const deptCheck = await query('SELECT id FROM groups WHERE id = $1', [
      params.id,
    ]);

    if (deptCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // Delete group
    await query('DELETE FROM groups WHERE id = $1', [params.id]);

    return NextResponse.json({
      message: 'Department deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete department error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
