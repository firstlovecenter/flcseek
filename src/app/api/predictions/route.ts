import { NextRequest, NextResponse } from 'next/server';
import { PredictiveAnalyticsService } from '@/lib/predictive-analytics';
import { logger } from '@/lib/logger';

/**
 * GET /api/predictions
 * Get predictions for converts
 * Query: convertId?, groupId?, category?
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'User ID required',
        },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const convertId = searchParams.get('convertId');
    const groupId = searchParams.get('groupId');
    const category = searchParams.get('category');

    if (convertId) {
      // Get prediction for single convert
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
    }

    if (groupId && !category) {
      // Get all predictions for group
      const outcomes = await PredictiveAnalyticsService.predictGroupOutcomes(groupId);

      return NextResponse.json({
        success: true,
        groupId,
        outcomes,
      });
    }

    if (groupId && category) {
      // Get predictions by category
      const categories = await PredictiveAnalyticsService.getConvertsByCategory(groupId);

      const categoryKey = category as keyof typeof categories;
      if (!categoryKey || !categories[categoryKey]) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid category',
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        groupId,
        category,
        converts: categories[categoryKey],
        count: categories[categoryKey].length,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'convertId or groupId is required',
      },
      { status: 400 }
    );
  } catch (error) {
    logger.error('GET /api/predictions error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get predictions',
      },
      { status: 500 }
    );
  }
}
