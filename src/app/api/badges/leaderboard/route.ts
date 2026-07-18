import { NextRequest, NextResponse } from 'next/server';
import { AchievementBadgesService } from '@/lib/achievement-badges';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/api/middleware';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const groupId = request.nextUrl.searchParams.get('groupId') || undefined;
    const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get('limit') || '20'));

    const leaderboard = await AchievementBadgesService.getLeaderboard(groupId, limit);

    return NextResponse.json({ leaderboard }, { status: 200 });
  } catch (error) {
    logger.error('Get leaderboard error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
