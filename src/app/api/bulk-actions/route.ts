import { NextRequest, NextResponse } from 'next/server';
import { BulkActionsService } from '@/lib/bulk-actions';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/api/middleware';

export async function POST(request: NextRequest) {
  try {
    // Get user from header
    const { user, error: authError } = requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    // Verify user is authorized
    if (!['superadmin', 'leadpastor', 'overseer', 'admin', 'leader'].includes(user!.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { action, filters, newStatus, milestoneId, convertIds, groupId } = body;

    if (action === 'delete' && user!.role === 'leader') {
      return NextResponse.json({ error: 'Insufficient permissions to delete' }, { status: 403 });
    }

    let result;

    switch (action) {
      case 'reassignGroup':
        result = await BulkActionsService.bulkUpdateStatus(filters, newStatus || 'active', groupId);
        break;

      case 'assignMilestone':
        result = await BulkActionsService.bulkAssignMilestone(filters, milestoneId, groupId);
        break;

      case 'delete':
        result = await BulkActionsService.bulkDelete(convertIds, groupId);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    logger.info('Bulk action executed', {
      action,
      userId,
      success: result.successCount,
      total: result.targetCount,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('Bulk actions endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user from header
    const { user, error: authError } = requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId) {
      return NextResponse.json({ error: 'groupId required' }, { status: 400 });
    }

    const history = await BulkActionsService.getBulkActionHistory(groupId);

    return NextResponse.json({ history }, { status: 200 });
  } catch (error) {
    logger.error('Get bulk action history error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
