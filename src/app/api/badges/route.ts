import { NextRequest, NextResponse } from 'next/server';
import { AchievementBadgesService } from '@/lib/achievement-badges';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api/middleware';

export async function GET(request: NextRequest) {
  try {
    // Get user from header
    const { user, error: authError } = requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const convertId = request.nextUrl.searchParams.get('convertId');
    const groupId = request.nextUrl.searchParams.get('groupId');

    if (convertId) {
      // Get user badges
      const badges = await AchievementBadgesService.getUserBadges(convertId);
      return NextResponse.json({ badges }, { status: 200 });
    } else {
      // Get all badges
      const badges = await AchievementBadgesService.getAllBadges();
      return NextResponse.json({ badges }, { status: 200 });
    }
  } catch (error) {
    logger.error('Get badges endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !['superadmin', 'leadpastor', 'overseer'].includes(user.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { convertId } = body;

    if (!convertId) {
      return NextResponse.json({ error: 'convertId required' }, { status: 400 });
    }

    // Evaluate and award badges
    const awardedBadges = await AchievementBadgesService.evaluateAndAwardBadges(convertId);

    logger.info('Badges evaluated', {
      convertId,
      awarded: awardedBadges.length,
    });

    return NextResponse.json({ awardedBadges }, { status: 200 });
  } catch (error) {
    logger.error('Evaluate badges error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
