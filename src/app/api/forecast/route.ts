import { NextRequest, NextResponse } from 'next/server';
import { GrowthForecastingService } from '@/lib/growth-forecasting';
import { logger } from '@/lib/logger';

/**
 * GET /api/forecast
 * Query: groupId?, weeks?, horizon?
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 401 });
    }

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
