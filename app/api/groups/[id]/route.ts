import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// GET /api/groups/[id] - Get a specific group
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await query(
      `SELECT 
        g.id,
        g.name,
        g.year,
        g.description,
        g.sheep_seeker_id,
        g.created_at,
        g.updated_at,
        u.username as leader_username,
        u.first_name as leader_first_name,
        u.last_name as leader_last_name,
        u.email as leader_email,
        (SELECT COUNT(*) FROM registered_people WHERE group_name = g.name) as member_count
      FROM groups g
      LEFT JOIN users u ON g.sheep_seeker_id = u.id
      WHERE g.id = $1`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json({ group: result.rows[0] });
  } catch (error: any) {
    console.error('Error fetching group:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/groups/[id] - Update a group
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, sheep_seeker_id, year } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      );
    }

    // Check if group exists
    const existing = await query(
      'SELECT id, name, year FROM groups WHERE id = $1',
      [params.id]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const oldGroupName = existing.rows[0].name;
    const oldYear = existing.rows[0].year;

    // Check if new name + year conflicts with another group
    if (name.trim() !== oldGroupName || year !== oldYear) {
      const nameCheck = await query(
        'SELECT id FROM groups WHERE name = $1 AND year = $2 AND id != $3',
        [name.trim(), year || oldYear, params.id]
      );

      if (nameCheck.rows.length > 0) {
        return NextResponse.json(
          { error: `Group ${name} ${year || oldYear} already exists` },
          { status: 409 }
        );
      }
    }

    // If sheep_seeker_id is provided, verify user exists and update role
    if (sheep_seeker_id) {
      const userResult = await query(
        'SELECT id, role FROM users WHERE id = $1',
        [sheep_seeker_id]
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Leader user not found' },
          { status: 404 }
        );
      }

      // Update user role to sheep_seeker
      if (userResult.rows[0].role !== 'sheep_seeker') {
        await query(
          'UPDATE users SET role = $1 WHERE id = $2',
          ['sheep_seeker', sheep_seeker_id]
        );
      }
    }

    // Update the group
    const updateFields = ['name = $1', 'description = $2', 'sheep_seeker_id = $3'];
    const updateValues: any[] = [name.trim(), description || null, sheep_seeker_id || null];
    let paramCounter = 4;

    if (year !== undefined && year !== oldYear) {
      updateFields.push(`year = $${paramCounter}`);
      updateValues.push(year);
      paramCounter++;
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(params.id);

    const result = await query(
      `UPDATE groups 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCounter}
       RETURNING id, name, year, description, sheep_seeker_id, created_at, updated_at`,
      updateValues
    );

    // If group name changed, update registered_people records
    if (name.trim() !== oldGroupName) {
      await query(
        'UPDATE registered_people SET group_name = $1 WHERE group_name = $2',
        [name.trim(), oldGroupName]
      );
    }

    return NextResponse.json({
      message: 'Group updated successfully',
      group: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error updating group:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id] - Delete a group
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if group exists and has members
    const groupCheck = await query(
      `SELECT 
        g.id, 
        g.name,
        (SELECT COUNT(*) FROM registered_people WHERE group_name = g.name) as member_count
       FROM groups g
       WHERE g.id = $1`,
      [params.id]
    );

    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const memberCount = parseInt(groupCheck.rows[0].member_count);

    if (memberCount > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete group with ${memberCount} members. Please reassign or remove members first.` 
        },
        { status: 400 }
      );
    }

    // Delete the group
    await query('DELETE FROM groups WHERE id = $1', [params.id]);

    return NextResponse.json({
      message: 'Group deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting group:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
