import { NextRequest, NextResponse } from 'next/server';
import { SavedSearchesService } from '@/lib/saved-searches';
import { logger } from '@/lib/logger';
import { SavedSearchFilters } from '@/lib/types/advanced-features';
import { requireAuth } from '@/lib/api/middleware';

type Params = Promise<{ id: string }>;

/**
 * GET /api/searches/[id]
 * Get a specific saved search
 */
export async function GET(request: NextRequest, context: { params: Params }) {
  try {
    const params = await context.params;
    const { id } = params;

    const savedSearch = await SavedSearchesService.getSavedSearch(id);

    if (!savedSearch) {
      return NextResponse.json(
        {
          success: false,
          error: 'Search not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      search: savedSearch,
    });
  } catch (error) {
    logger.error('GET /api/searches/[id] error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get search',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/searches/[id]
 * Update a saved search
 * Body: {name?, filters?, description?, isSmart?, isPublic?}
 */
export async function PUT(request: NextRequest, context: { params: Params }) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const params = await context.params;
    const { id } = params;
    const body = await request.json();

    // Verify ownership
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

    if (search.userId !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 403 }
      );
    }

    const updated = await SavedSearchesService.updateSavedSearch(id, body);

    logger.info('Saved search updated via API', {
      searchId: id,
      userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Search updated successfully',
      search: updated,
    });
  } catch (error) {
    logger.error('PUT /api/searches/[id] error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update search',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/searches/[id]
 * Delete a saved search
 */
export async function DELETE(request: NextRequest, context: { params: Params }) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const params = await context.params;
    const { id } = params;

    // Verify ownership
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

    if (search.userId !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 403 }
      );
    }

    await SavedSearchesService.deleteSavedSearch(id);

    logger.info('Saved search deleted via API', {
      searchId: id,
      userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Search deleted successfully',
    });
  } catch (error) {
    logger.error('DELETE /api/searches/[id] error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete search',
      },
      { status: 500 }
    );
  }
}
