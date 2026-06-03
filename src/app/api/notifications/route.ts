import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api/middleware';
import { 
  getUnreadNotifications, 
  markNotificationsRead,
  getNotificationSummary,
  getBirthdaysThisWeek,
  getInactiveConverts,
} from '@/lib/notifications';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Get notifications for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const userPayload = getAuthUser(request);

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    let data: Record<string, unknown> = {};

    if (type === 'summary' || type === 'all') {
      data.summary = await getNotificationSummary(userPayload.id);
    }

    if (type === 'notifications' || type === 'all') {
      data.notifications = await getUnreadNotifications(userPayload.id);
    }

    if (type === 'birthdays' || type === 'all') {
      data.birthdays = await getBirthdaysThisWeek();
    }

    if (type === 'inactive' || type === 'all') {
      // Only show inactive converts to admins and above
      if (['superadmin', 'leadpastor', 'admin'].includes(userPayload.role)) {
        const weeksInactive = parseInt(searchParams.get('weeks') || '4');
        data.inactiveConverts = await getInactiveConverts(weeksInactive);
      }
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const userPayload = getAuthUser(request);

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notificationIds } = await request.json();

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json(
        { error: 'notificationIds array is required' },
        { status: 400 }
      );
    }

    await markNotificationsRead(notificationIds);

    return NextResponse.json({ message: 'Notifications marked as read' });
  } catch (error: unknown) {
    console.error('Error marking notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
