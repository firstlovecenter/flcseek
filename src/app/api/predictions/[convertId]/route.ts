import { NextRequest, NextResponse } from 'next/server';
import { PredictiveAnalyticsService } from '@/lib/predictive-analytics';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/api/middleware';

type Params = Promise<{ convertId: string }>;

/**
 * GET /api/predictions/[convertId]
 * Get prediction and recommendations for a specific convert
 * Query: type='full'|'recommendation'
 */
export async function GET(request: NextRequest, context: { params: Params }) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const params = await context.params;
    const { convertId } = params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'full';

    if (type === 'recommendation') {
      const recommendations = await PredictiveAnalyticsService.getRecommendedActions(convertId);

      if (!recommendations) {
        return NextResponse.json(
          {
            success: false,
            error: 'Could not generate recommendations',
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        recommendations,
      });
    }

    // Default: full prediction with details
    const prediction = await PredictiveAnalyticsService.predictCompletionProbability(convertId);

    if (!prediction) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not generate prediction',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      prediction,
    });
  } catch (error) {
    logger.error('GET /api/predictions/[convertId] error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get prediction',
      },
      { status: 500 }
    );
  }
}
