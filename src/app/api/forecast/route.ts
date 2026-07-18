import { NextRequest, NextResponse } from 'next/server';
import { GrowthForecastingService } from '@/lib/growth-forecasting';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/api/middleware';

/**
 * GET /api/forecast
 * Query: groupId?, weeks?, horizon?
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const searchParams = request.nextUrl.searchParams;
    const groupId = searchParams.get('groupId') || undefined;
    const weeks = parseInt(searchParams.get('weeks') || '12', 10);
    const horizon = parseInt(searchParams.get('horizon') || '4', 10);

    const forecast = await GrowthForecastingService.forecast({ groupId, weeks, horizon });

    return NextResponse.json({ success: true, forecast });
  } catch (error) {
    logger.error('GET /api/forecast error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ success: false, error: 'Failed to generate forecast' }, { status: 500 });
  }
}
