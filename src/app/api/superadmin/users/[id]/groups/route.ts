import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit-log';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/superadmin/users/[id]/groups
 * Get all groups assigned to a user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    const userGroups = await prisma.userGroup.findMany({
      where: { userId: id },
      include: {
        group: {
          select: {
            name: true,
            year: true,
          }
        }
      },
      orderBy: [
        { group: { year: 'desc' } },
        { group: { name: 'asc' } },
      ]
    });

    const groups = userGroups.map((ug: any) => ({
      id: ug.id,
      group_id: ug.groupId,
      group_name: ug.group.name,
      group_year: ug.group.year,
      assigned_at: ug.createdAt,
    }));

    return NextResponse.json({ groups });
  } catch (error) {
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { groupId } = await request.json();

    if (!groupId) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
    }

    // Check if assignment already exists
    const existing = await prisma.userGroup.findUnique({
      where: {
        userId_groupId: {
          userId: id,
          groupId: groupId,
        }
      }
    });

    if (existing) {
      return NextResponse.json({ error: 'User already assigned to this group' }, { status: 400 });
    }

    // Create assignment
    await prisma.userGroup.create({
      data: {
        userId: id,
        groupId: groupId,
      }
    });

    // Log the activity
    await logAuditEvent({
      userId: userPayload.id,
      action: 'CREATE_USER' as string,
      entityType: 'user',
      entityId: id,
      newValues: { groupId },
    });

    return NextResponse.json({ message: 'Group assigned successfully' });
  } catch (error) {
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { groupIds } = await request.json();

    if (!Array.isArray(groupIds)) {
      return NextResponse.json({ error: 'groupIds must be an array' }, { status: 400 });
    }

    // Use transaction to delete and recreate
    await prisma.$transaction(async (tx) => {
      // Delete all existing assignments
      await tx.userGroup.deleteMany({
        where: { userId: id }
      });

      // Insert new assignments
      if (groupIds.length > 0) {
        await tx.userGroup.createMany({
          data: groupIds.map((gid: string) => ({
            userId: id,
            groupId: gid,
          }))
        });
      }
    });

    // Log the activity
    await logAuditEvent({
      userId: userPayload.id,
      action: 'UPDATE_USER' as string,
      entityType: 'user',
      entityId: id,
      newValues: { groupIds, count: groupIds.length },
    });

    return NextResponse.json({ 
      message: 'Groups updated successfully',
      count: groupIds.length 
    });
  } catch (error) {
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (!groupId) {
      return NextResponse.json({ error: 'groupId query parameter is required' }, { status: 400 });
    }

    await prisma.userGroup.deleteMany({
      where: {
        userId: id,
        groupId: groupId,
      }
    });

    // Log the activity
    await logAuditEvent({
      userId: userPayload.id,
      action: 'DELETE_USER' as string,
      entityType: 'user',
      entityId: id,
      oldValues: { groupId },
    });

    return NextResponse.json({ message: 'Group removed successfully' });
  } catch (error) {
    console.error('Error removing group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
