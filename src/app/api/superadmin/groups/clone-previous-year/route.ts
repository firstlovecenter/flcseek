import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthUser } from '@/lib/api/middleware';
import { cloneGroupsToCurrentYear } from '@/lib/year-rollover';

/**
 * POST /api/superadmin/groups/clone-previous-year
 *
 * Clones all groups from the previous year to the current year.
 * Runs automatically on January 1st via the scheduled-yearly-rollover Netlify
 * function; this endpoint is the manual superadmin-UI trigger. Both paths are
 * idempotent (existing current-year groups are skipped).
 */
export async function POST(request: NextRequest) {
  try {
    const userPayload = await getVerifiedAuthUser(request);
    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only superadmin can clone groups
    if (userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const previousYear = new Date().getFullYear() - 1;
    const result = await cloneGroupsToCurrentYear(userPayload.id);

    return NextResponse.json({
      message:
        result.clonedCount === 0 && result.skippedCount === 0
          ? 'No groups found to clone from previous year'
          : `Successfully cloned ${result.clonedCount} groups from ${previousYear} to ${previousYear + 1}`,
      ...result,
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
