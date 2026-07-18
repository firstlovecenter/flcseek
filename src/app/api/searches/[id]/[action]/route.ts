import { NextRequest, NextResponse } from 'next/server';
import { SavedSearchesService } from '@/lib/saved-searches';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/api/middleware';

type Params = Promise<{ id: string; action: string }>;

/**
 * POST /api/searches/[id]/[action]
 * Execute search actions (share, unshare, duplicate)
 * Actions: share, unshare, duplicate
 */
export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const params = await context.params;
    const { id, action } = params;

    // Get the search to verify ownership (except for duplicate where we create a copy)
    const search = await SavedSearchesService.getSavedSearch(id);
    if (!search) {
      return NextResponse.json(
        {
          success: false,
          error: 'Search not found',
        },
        { status: 404 }
      );
    }

    if (action !== 'duplicate' && search.userId !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 403 }
      );
    }

    let result;
    let message = '';

    switch (action) {
      case 'share':
        result = await SavedSearchesService.shareSearch(id);
        message = 'Search shared with team';
        break;

      case 'unshare':
        result = await SavedSearchesService.unshareSearch(id);
        message = 'Search unshared from team';
        break;

      case 'duplicate':
        const body = await request.json();
        const { newName } = body;

        if (!newName) {
          return NextResponse.json(
            {
              success: false,
              error: 'New name is required for duplicate',
            },
            { status: 400 }
          );
        }

        result = await SavedSearchesService.duplicateSearch(id, userId, newName);
        message = 'Search duplicated successfully';
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action',
          },
          { status: 400 }
        );
    }

    logger.info('Search action executed via API', {
      searchId: id,
      action,
      userId,
    });

    return NextResponse.json({
      success: true,
      message,
      search: result,
    });
  } catch (error) {
    logger.error('POST /api/searches/[id]/[action] error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute action',
      },
      { status: 500 }
    );
  }
}
