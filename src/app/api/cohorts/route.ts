import { NextRequest, NextResponse } from 'next/server';
import { CohortAnalysisService } from '@/lib/cohort-analysis';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/api/middleware';

/**
 * GET /api/cohorts
 * Query: months?, groupId?
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const searchParams = request.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '6', 10);
    const groupId = searchParams.get('groupId') || undefined;

    const cohorts = await CohortAnalysisService.buildCohortsByMonth({ months, groupId });

    return NextResponse.json({ success: true, cohorts });
  } catch (error) {
    logger.error('GET /api/cohorts error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ success: false, error: 'Failed to fetch cohorts' }, { status: 500 });
  }
}
