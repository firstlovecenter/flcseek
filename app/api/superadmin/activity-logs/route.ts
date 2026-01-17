import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getActivityLogs, getActivitySummary } from '@/lib/audit-log';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/superadmin/activity-logs
 * Get activity logs for audit trail (superadmin only)
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only superadmin can view activity logs
    if (userPayload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only superadmin can view activity logs' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'logs'; // 'logs' or 'summary'
    const userId = searchParams.get('user_id');
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const days = parseInt(searchParams.get('days') || '7');

    if (type === 'summary') {
      const summary = await getActivitySummary(days);
      return NextResponse.json({ summary });
    }

    const logs = await getActivityLogs({
      userId: userId || undefined,
      entityType: entityType as any,
      entityId: entityId || undefined,
      action: action as any,
      limit,
      offset,
    });

    return NextResponse.json({ 
      logs,
      pagination: {
        limit,
        offset,
        hasMore: logs.length === limit,
      },
    });
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
