import { NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken, hashPassword } from '@/lib/auth';

// GET /api/users/[id] - Get a specific user
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;

    const result = await query(
      `SELECT id, email, first_name, last_name, phone_number, role, group_name, created_at, updated_at
       FROM users 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: result.rows[0] });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update a user
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();
    const { first_name, last_name, email, phone_number, role, group_name, password } = body;
    
    console.log('PUT /api/users/[id] - User ID:', id);
    console.log('PUT /api/users/[id] - Request body:', body);

    // Check if user exists
    const userCheck = await query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Validate role if provided
    if (role && !['superadmin', 'leader'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be superadmin or leader' },
        { status: 400 }
      );
    }

    // If role is leader, group_name should be provided
    if (role === 'leader' && !group_name) {
      return NextResponse.json(
        { error: 'Group assignment required for leader role' },
        { status: 400 }
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(first_name);
    }
    if (last_name !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(last_name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (phone_number !== undefined) {
      updates.push(`phone_number = $${paramCount++}`);
      values.push(phone_number);
    }
    if (role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (group_name !== undefined) {
      updates.push(`group_name = $${paramCount++}`);
      values.push(group_name);
    }
    if (password) {
      const hashedPassword = hashPassword(password);
      updates.push(`password = $${paramCount++}`);
      values.push(hashedPassword);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, phone_number, role, group_name, created_at, updated_at
    `;

    console.log('PUT /api/users/[id] - SQL:', updateQuery);
    console.log('PUT /api/users/[id] - Values:', values);
    
    const result = await query(updateQuery, values);
    
    console.log('PUT /api/users/[id] - Result:', result.rows[0]);

    // If role or group changed, update group leader_id
    const updatedUser = result.rows[0];
    if (updatedUser.role === 'leader' && updatedUser.group_name) {
      try {
        await query(
          `UPDATE groups SET leader_id = $1, updated_at = NOW() WHERE name = $2`,
          [updatedUser.id, updatedUser.group_name]
        );
      } catch (error) {
        console.error('Failed to update group leader:', error);
        // Don't fail the update if this fails
      }
    }

    // If user was removed from a group or role changed, clear old group leader
    if (group_name !== undefined || role !== undefined) {
      try {
        await query(
          `UPDATE groups SET leader_id = NULL, updated_at = NOW() 
           WHERE leader_id = $1 AND name != $2`,
          [updatedUser.id, updatedUser.group_name || '']
        );
      } catch (error) {
        console.error('Failed to clear old group leader:', error);
      }
    }

    return NextResponse.json({
      message: 'User updated successfully',
      user: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete a user
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;

    // Check if user exists and get their role
    const userCheck = await query('SELECT username, role FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUser = userCheck.rows[0];

    // Prevent deletion of superadmin users
    if (targetUser.role === 'superadmin') {
      return NextResponse.json(
        { error: 'Cannot delete super admin users' },
        { status: 403 }
      );
    }

    // Also prevent deletion of the default admin user
    if (targetUser.username === 'admin') {
      return NextResponse.json({ error: 'Cannot delete default admin user' }, { status: 403 });
    }

    await query('DELETE FROM users WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
