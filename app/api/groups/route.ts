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

    const userPayload = verifyToken(token);
    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sql = `
      SELECT 
        g.id,
        g.name,
        g.year,
        g.description,
        g.sheep_seeker_id as leader_id,
        g.start_date,
        g.end_date,
        g.is_active,
        g.created_at,
        g.updated_at,
        u.username as leader_username,
        (SELECT COUNT(*) FROM registered_people WHERE group_id = g.id) as member_count
      FROM groups g
      LEFT JOIN users u ON g.sheep_seeker_id = u.id
      ORDER BY g.is_active DESC, g.year DESC, g.name ASC
    `;

    const result = await query(sql);

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

    const userPayload = verifyToken(token);
    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only superadmin can create groups
    if (userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, sheep_seeker_id, start_date, year } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      );
    }

    // Year is required
    if (!year) {
      return NextResponse.json(
        { error: 'Year is required' },
        { status: 400 }
      );
    }

    // Check if group name + year combination already exists
    const existing = await query(
      'SELECT id FROM groups WHERE name = $1 AND year = $2',
      [name.trim(), year]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: `Group ${name} ${year} already exists` },
        { status: 409 }
      );
    }

    // If sheep_seeker_id is provided, verify the user exists
    if (sheep_seeker_id) {
      const userResult = await query(
        'SELECT id, role FROM users WHERE id = $1',
        [sheep_seeker_id]
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Sheep seeker not found' },
          { status: 404 }
        );
      }

      // Update user role to leader if not already
      if (userResult.rows[0].role !== 'leader') {
        await query(
          'UPDATE users SET role = $1, group_id = $2 WHERE id = $3',
          ['leader', null, sheep_seeker_id] // Will update group_id after creation
        );
      }
    }

    // Calculate end_date (12 months from start_date)
    const groupStartDate = start_date || new Date().toISOString().split('T')[0];
    const startDateObj = new Date(groupStartDate);
    const endDateObj = new Date(startDateObj);
    endDateObj.setMonth(endDateObj.getMonth() + 12);
    const endDate = endDateObj.toISOString().split('T')[0];

    const result = await query(
      `INSERT INTO groups (name, year, description, sheep_seeker_id, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name.trim(), year, description || null, sheep_seeker_id || null, groupStartDate, endDate, true]
    );

    // Update sheep seeker's group_id
    if (sheep_seeker_id) {
      await query(
        'UPDATE users SET group_id = $1 WHERE id = $2',
        [result.rows[0].id, sheep_seeker_id]
      );
    }

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
