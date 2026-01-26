import { NextRequest, NextResponse } from 'next/server';
import { AchievementBadgesService } from '@/lib/achievement-badges';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const action = request.nextUrl.searchParams.get('action');

    if (action === 'progress') {
      // Get badge progress for a user
      const progress = await AchievementBadgesService.getBadgeProgress(id);
      return NextResponse.json({ progress }, { status: 200 });
    }

    // Default: return user badges
    const badges = await AchievementBadgesService.getUserBadges(id);
    return NextResponse.json({ badges }, { status: 200 });
  } catch (error) {
    logger.error('Get user badges error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
