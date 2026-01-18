import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit-log';

/**
 * POST /api/superadmin/groups/clone-previous-year
 *
 * Clones all groups from the previous year to the current year.
 * This should run automatically on January 1st every year, or can be triggered manually.
 *
 * Features:
 * - Clones all active groups from previous year to current year
 * - Preserves group leaders and descriptions
 * - Creates new groups with same names but current year
 * - Skips groups that already exist in current year
 * - Returns count of cloned groups and any errors
 */
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

    // Only superadmin can clone groups
    if (userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    // Fetch all active groups from previous year
    const previousYearGroups = await prisma.group.findMany({
      where: {
        year: previousYear,
        archived: false,
      },
      orderBy: { name: 'asc' },
    });

    if (previousYearGroups.length === 0) {
      return NextResponse.json({
        message: 'No groups found to clone from previous year',
        clonedCount: 0,
        skippedCount: 0,
        groups: [],
      });
    }

    const clonedGroups = [];
    let skippedCount = 0;

    // Clone each group to current year
    for (const group of previousYearGroups) {
      try {
        // Check if group already exists in current year
        const existing = await prisma.group.findFirst({
          where: {
            name: group.name,
            year: currentYear,
          },
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        // Clone the group with same name, description, and leader
        const newGroup = await prisma.group.create({
          data: {
            name: group.name,
            description: group.description,
            year: currentYear,
            leaderId: group.leaderId,
            archived: false,
          },
        });

        clonedGroups.push(newGroup);

        // Log audit event
        await logAuditEvent({
          userId: userPayload.id,
          action: 'CLONE_GROUP',
          entityType: 'group',
          entityId: newGroup.id,
          newValues: {
            sourceYear: previousYear,
            targetYear: currentYear,
            groupName: group.name,
            leaderId: group.leaderId,
          },
        });
      } catch (error) {
        console.error(`Error cloning group ${group.name}:`, error);
        // Continue with next group instead of failing entirely
      }
    }

    return NextResponse.json({
      message: `Successfully cloned ${clonedGroups.length} groups from ${previousYear} to ${currentYear}`,
      clonedCount: clonedGroups.length,
      skippedCount,
      groups: clonedGroups,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error cloning groups:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
