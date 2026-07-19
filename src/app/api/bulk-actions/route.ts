import { NextRequest, NextResponse } from 'next/server';
import { BulkActionsService } from '@/lib/bulk-actions';
import { logger } from '@/lib/logger';
import {
  requireAuth,
  assertGroupAccess,
  isGroupScopedRole,
} from '@/lib/api/middleware';
import * as Groups from '@/lib/db/queries/groups';
import { prisma } from '@/lib/prisma';

async function resolveScopedGroupId(
  user: NonNullable<Awaited<ReturnType<typeof requireAuth>>['user']>,
  groupId?: string
): Promise<{ groupId?: string; error?: NextResponse }> {
  if (!groupId) {
    if (isGroupScopedRole(user.role)) {
      if (!user.group_id) {
        return {
          error: NextResponse.json(
            { error: 'groupId required for your role' },
            { status: 400 }
          ),
        };
      }
      return { groupId: user.group_id };
    }
    return { groupId: undefined };
  }

  const group = await Groups.findById(groupId);
  if (!group) {
    return {
      error: NextResponse.json({ error: 'Group not found' }, { status: 404 }),
    };
  }
  const scopeError = assertGroupAccess(user, {
    id: group.id,
    name: group.name,
  });
  if (scopeError) return { error: scopeError };
  return { groupId: group.id };
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    if (
      !['superadmin', 'leadpastor', 'overseer', 'admin', 'leader'].includes(
        user!.role || ''
      )
    ) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { action, filters, newStatus, milestoneId, convertIds, groupId } = body;

    if (action === 'delete' && user!.role === 'leader') {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete' },
        { status: 403 }
      );
    }

    const scoped = await resolveScopedGroupId(user!, groupId);
    if (scoped.error) return scoped.error;
    const effectiveGroupId = scoped.groupId;

    // Expand empty selection to all active converts in the scoped group
    let effectiveConvertIds: string[] | undefined = convertIds;
    if (
      action === 'delete' &&
      (!Array.isArray(convertIds) || convertIds.length === 0) &&
      effectiveGroupId
    ) {
      const rows = await prisma.newConvert.findMany({
        where: { groupId: effectiveGroupId, deletedAt: null },
        select: { id: true },
      });
      effectiveConvertIds = rows.map((r) => r.id);
    }

    let result;

    switch (action) {
      case 'reassignGroup':
        result = await BulkActionsService.bulkUpdateStatus(
          filters || [],
          newStatus || 'active',
          effectiveGroupId
        );
        break;

      case 'assignMilestone':
        result = await BulkActionsService.bulkAssignMilestone(
          filters || [],
          milestoneId,
          effectiveGroupId
        );
        break;

      case 'delete':
        if (!effectiveConvertIds?.length) {
          return NextResponse.json(
            { error: 'No converts selected and no group converts found' },
            { status: 400 }
          );
        }
        result = await BulkActionsService.bulkDelete(
          effectiveConvertIds,
          effectiveGroupId
        );
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    logger.info('Bulk action executed', {
      action,
      userId: user!.id,
      success: result.successCount,
      total: result.targetCount,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('Bulk actions endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId) {
      return NextResponse.json({ error: 'groupId required' }, { status: 400 });
    }

    const scoped = await resolveScopedGroupId(user!, groupId);
    if (scoped.error) return scoped.error;

    const history = await BulkActionsService.getBulkActionHistory(groupId);

    return NextResponse.json({ history }, { status: 200 });
  } catch (error) {
    logger.error('Get bulk action history error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
