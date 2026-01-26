import { NextRequest, NextResponse } from 'next/server';
import { SavedSearchesService } from '@/lib/saved-searches';
import { logger } from '@/lib/logger';
import { SavedSearchFilters } from '@/lib/types/advanced-features';

/**
 * GET /api/searches
 * Get saved searches for user
 * Query: type='user'|'public'|'recent', limit?
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
    const type = searchParams.get('type') || 'user';
    const limit = parseInt(searchParams.get('limit') || '10');

    let searches;

    if (type === 'user') {
      searches = await SavedSearchesService.getUserSavedSearches(userId);
    } else if (type === 'public') {
      searches = await SavedSearchesService.getPublicSearches();
    } else if (type === 'recent') {
      searches = await SavedSearchesService.getRecentSearches(userId, limit);
    } else if (type === 'smart') {
      searches = await SavedSearchesService.getSmartSearches(userId);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid type parameter',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      type,
      count: searches.length,
      searches,
    });
  } catch (error) {
    logger.error('GET /api/searches error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get searches',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/searches
 * Create a new saved search
 * Body: {name, filters, description?, isSmart?, isPublic?}
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, filters, description, isSmart = false, isPublic = false } = body;

    if (!name || !filters) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name and filters are required',
        },
        { status: 400 }
      );
    }

    const savedSearch = await SavedSearchesService.createSavedSearch(
      userId,
      name,
      filters as SavedSearchFilters,
      {
        description,
        isSmart,
        isPublic,
      }
    );

    logger.info('Saved search created via API', {
      searchId: savedSearch.id,
      userId,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Search saved successfully',
        search: savedSearch,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('POST /api/searches error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create search',
      },
      { status: 500 }
    );
  }
}
