import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// GET /api/groups - List all groups
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await query(`
      SELECT 
        g.id,
        g.name,
        g.description,
        g.leader_id,
        g.created_at,
        g.updated_at,
        u.username as leader_username,
        u.first_name as leader_first_name,
        u.last_name as leader_last_name,
        (SELECT COUNT(*) FROM registered_people WHERE group_name = g.name) as member_count
      FROM groups g
      LEFT JOIN users u ON g.leader_id = u.id
      ORDER BY g.name ASC
    `);

    return NextResponse.json({ groups: result.rows });
  } catch (error: any) {
    console.error('Error fetching groups:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/groups - Create a new group
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, leader_id } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      );
    }

    // Check if group name already exists
    const existing = await query(
      'SELECT id FROM groups WHERE name = $1',
      [name.trim()]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Group name already exists' },
        { status: 409 }
      );
    }

    // If leader_id is provided, verify the user exists and update their role
    if (leader_id) {
      const userResult = await query(
        'SELECT id, role FROM users WHERE id = $1',
        [leader_id]
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Leader user not found' },
          { status: 404 }
        );
      }

      // Update user role to sheep_seeker if not already
      if (userResult.rows[0].role !== 'sheep_seeker') {
        await query(
          'UPDATE users SET role = $1 WHERE id = $2',
          ['sheep_seeker', leader_id]
        );
      }
    }

    const result = await query(
      `INSERT INTO groups (name, description, leader_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, leader_id, created_at, updated_at`,
      [name.trim(), description || null, leader_id || null]
    );

    return NextResponse.json({
      message: 'Group created successfully',
      group: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error creating group:', error);
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Group name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
