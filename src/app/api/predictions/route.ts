import { NextRequest, NextResponse } from 'next/server';
import { PredictiveAnalyticsService } from '@/lib/predictive-analytics';
import { logger } from '@/lib/logger';
import {
  requireAuth,
  assertPersonAccess,
  assertGroupAccess,
  assertScopedAssignment,
} from '@/lib/api/middleware';
import * as People from '@/lib/db/queries/people';
import * as Groups from '@/lib/db/queries/groups';

/**
 * GET /api/predictions
 * Get predictions for converts
 * Query: convertId?, groupId?, category?
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const assignmentError = assertScopedAssignment(user!);
    if (assignmentError) return assignmentError;

    const searchParams = request.nextUrl.searchParams;
    const convertId = searchParams.get('convertId');
    const groupId = searchParams.get('groupId');
    const category = searchParams.get('category');

    if (convertId) {
      const person = await People.findById(convertId);
      if (!person) {
        return NextResponse.json(
          { success: false, error: 'Convert not found' },
          { status: 404 }
        );
      }
      const accessError = assertPersonAccess(user!, person);
      if (accessError) return accessError;

      const prediction =
        await PredictiveAnalyticsService.predictCompletionProbability(convertId);

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
      const group = await Groups.findById(groupId);
      if (!group) {
        return NextResponse.json(
          { success: false, error: 'Group not found' },
          { status: 404 }
        );
      }
      const scopeError = assertGroupAccess(user!, {
        id: group.id,
        name: group.name,
      });
      if (scopeError) return scopeError;

      const outcomes =
        await PredictiveAnalyticsService.predictGroupOutcomes(groupId);

      return NextResponse.json({
        success: true,
        groupId,
        outcomes,
      });
    }

    if (groupId && category) {
      const group = await Groups.findById(groupId);
      if (!group) {
        return NextResponse.json(
          { success: false, error: 'Group not found' },
          { status: 404 }
        );
      }
      const scopeError = assertGroupAccess(user!, {
        id: group.id,
        name: group.name,
      });
      if (scopeError) return scopeError;

      const categories =
        await PredictiveAnalyticsService.getConvertsByCategory(groupId);

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
