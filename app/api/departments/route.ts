import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// GET /api/departments - List all departments
export async function GET(request: NextRequest) {
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
       FROM departments d
       LEFT JOIN users u ON d.leader_id = u.id
       ORDER BY d.name ASC`
    );

    return NextResponse.json({ departments: result.rows });
  } catch (error: any) {
    console.error('Get departments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/departments - Create new department
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized. Only super admins can create departments.' },
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

    // Create department
    const result = await query(
      `INSERT INTO departments (name, description, leader_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), description?.trim() || null, leader_id || null]
    );

    return NextResponse.json({
      message: 'Department created successfully',
      department: result.rows[0],
    });
  } catch (error: any) {
    console.error('Create department error:', error);
    
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
