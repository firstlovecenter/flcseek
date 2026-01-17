import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/neon';
import { logAuditEvent } from '@/lib/audit-log';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/superadmin/users/[id]/groups
 * Get all groups assigned to a user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await query(
      `SELECT ug.id, ug.group_id, g.name as group_name, g.year as group_year, ug.assigned_at
       FROM user_groups ug
       JOIN groups g ON ug.group_id = g.id
       WHERE ug.user_id = $1
       ORDER BY g.year DESC, g.name`,
      [params.id]
    );

    return NextResponse.json({ groups: result.rows });
  } catch (error: any) {
    console.error('Error fetching user groups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/superadmin/users/[id]/groups
 * Assign a group to a user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { groupId } = await request.json();

    if (!groupId) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
    }

    // Check if assignment already exists
    const existing = await query(
      `SELECT id FROM user_groups WHERE user_id = $1 AND group_id = $2`,
      [params.id, groupId]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'User already assigned to this group' }, { status: 400 });
    }

    // Create assignment
    await query(
      `INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2)`,
      [params.id, groupId]
    );

    // Log the activity
    await logAuditEvent({
      userId: userPayload.id,
      action: 'CREATE_USER' as any,
      entityType: 'user',
      entityId: params.id,
      newValues: { groupId },
    });

    return NextResponse.json({ message: 'Group assigned successfully' });
  } catch (error: any) {
    console.error('Error assigning group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/superadmin/users/[id]/groups
 * Update all groups for a user (replace all existing assignments)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { groupIds } = await request.json();

    if (!Array.isArray(groupIds)) {
      return NextResponse.json({ error: 'groupIds must be an array' }, { status: 400 });
    }

    // Delete all existing assignments
    await query(`DELETE FROM user_groups WHERE user_id = $1`, [params.id]);

    // Insert new assignments
    if (groupIds.length > 0) {
      const values = groupIds.map((gid, i) => `($1, $${i + 2})`).join(', ');
      await query(
        `INSERT INTO user_groups (user_id, group_id) VALUES ${values}`,
        [params.id, ...groupIds]
      );
    }

    // Log the activity
    await logAuditEvent({
      userId: userPayload.id,
      action: 'UPDATE_USER' as any,
      entityType: 'user',
      entityId: params.id,
      newValues: { groupIds, count: groupIds.length },
    });

    return NextResponse.json({ 
      message: 'Groups updated successfully',
      count: groupIds.length 
    });
  } catch (error: any) {
    console.error('Error updating groups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/superadmin/users/[id]/groups
 * Remove a group assignment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (!groupId) {
      return NextResponse.json({ error: 'groupId query parameter is required' }, { status: 400 });
    }

    await query(
      `DELETE FROM user_groups WHERE user_id = $1 AND group_id = $2`,
      [params.id, groupId]
    );

    // Log the activity
    await logAuditEvent({
      userId: userPayload.id,
      action: 'DELETE_USER' as any,
      entityType: 'user',
      entityId: params.id,
      oldValues: { groupId },
    });

    return NextResponse.json({ message: 'Group removed successfully' });
  } catch (error: any) {
    console.error('Error removing group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
