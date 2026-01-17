import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
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
    const previousYearGroups = await query(
      'SELECT * FROM groups WHERE year = $1 AND archived = false ORDER BY name',
      [previousYear]
    );

    if (previousYearGroups.rows.length === 0) {
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
    for (const group of previousYearGroups.rows) {
      try {
        // Check if group already exists in current year
        const existing = await query(
          'SELECT id FROM groups WHERE name = $1 AND year = $2',
          [group.name, currentYear]
        );

        if (existing.rows.length > 0) {
          skippedCount++;
          continue;
        }

        // Clone the group with same name, description, and leader
        const result = await query(
          `INSERT INTO groups (name, description, year, leader_id, archived)
           VALUES ($1, $2, $3, $4, false)
           RETURNING *`,
          [group.name, group.description, currentYear, group.leader_id]
        );

        clonedGroups.push(result.rows[0]);

        // Log audit event
        await logAuditEvent({
          userId: userPayload.id,
          action: 'CLONE_GROUP',
          entityType: 'group',
          entityId: result.rows[0].id,
          newValues: {
            sourceYear: previousYear,
            targetYear: currentYear,
            groupName: group.name,
            leaderId: group.leader_id,
          }
        });
      } catch (error: any) {
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
  } catch (error: any) {
    console.error('Error cloning groups:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
